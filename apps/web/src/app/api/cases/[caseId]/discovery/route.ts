import {
  AuthorizationDeniedError,
  completeDiscovery,
  getDiscoveryState,
  saveDiscoveryAnswer,
} from "@resurgo/db";
import { z } from "zod";

import { recordAuthorizationDecision } from "../../../../../lib/authorization-audit";
import { getAuth, getDatabase } from "../../../../../lib/auth";

const requestBody = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("answer"),
    answer: z.object({
      status: z.enum(["answered", "unknown", "not_applicable", "deferred"]),
      value: z.unknown(),
    }),
    questionKey: z.string().min(1),
  }),
  z.object({ action: z.literal("complete") }),
]);

async function contextFor(request: Request, caseId: string) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return {
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    };
  if (!z.uuid().safeParse(caseId).success) {
    return {
      response: Response.json(
        { error: "Resource unavailable" },
        { status: 404 },
      ),
    };
  }
  return { session };
}

async function denied(userId: string, caseId: string) {
  await recordAuthorizationDecision(getDatabase(), {
    action: "discovery.access",
    actorUserId: userId,
    outcome: "denied",
    reasonCode: "case_access_denied",
    resourceId: caseId,
  });
  return Response.json({ error: "Resource unavailable" }, { status: 404 });
}

export async function GET(
  request: Request,
  route: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await route.params;
  const context = await contextFor(request, caseId);
  if ("response" in context) return context.response;
  try {
    return Response.json(
      {
        state: await getDiscoveryState(getDatabase(), {
          caseId,
          userId: context.session.user.id,
        }),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return denied(context.session.user.id, caseId);
  }
}

export async function POST(
  request: Request,
  route: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await route.params;
  const context = await contextFor(request, caseId);
  if ("response" in context) return context.response;
  const parsed = requestBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    if (parsed.data.action === "answer") {
      const saved = await saveDiscoveryAnswer(getDatabase(), {
        answer: {
          source: "client_reported",
          status: parsed.data.answer.status,
          value: parsed.data.answer.value,
          verificationStatus: "client_confirmed",
        },
        caseId,
        questionKey: parsed.data.questionKey,
        userId: context.session.user.id,
      });
      return Response.json(
        { saved },
        { headers: { "cache-control": "no-store" } },
      );
    }
    const state = await completeDiscovery(getDatabase(), {
      caseId,
      userId: context.session.user.id,
    });
    return Response.json(
      { state },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthorizationDeniedError) {
      return denied(context.session.user.id, caseId);
    }
    return Response.json(
      { error: "Discovery cannot be updated" },
      { status: 409 },
    );
  }
}
