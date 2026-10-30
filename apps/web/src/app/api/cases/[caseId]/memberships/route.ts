import { AuthorizationDeniedError, grantCaseMembership } from "@resurgo/db";
import { z } from "zod";

import { recordAuthorizationDecision } from "../../../../../lib/authorization-audit";
import { getAuth, getDatabase } from "../../../../../lib/auth";

const membershipRequest = z.object({
  userId: z.uuid(),
  role: z.enum([
    "co_client",
    "attorney",
    "lender",
    "accountant",
    "mediator",
    "support_professional",
    "coordinator",
  ]),
  organizationMembershipId: z.uuid().optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { caseId } = await context.params;
  if (!z.uuid().safeParse(caseId).success) {
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
  const parsed = membershipRequest.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const membership = await grantCaseMembership(getDatabase(), {
      actorUserId: session.user.id,
      caseId,
      role: parsed.data.role,
      userId: parsed.data.userId,
      ...(parsed.data.organizationMembershipId
        ? { organizationMembershipId: parsed.data.organizationMembershipId }
        : {}),
    });
    return Response.json(
      {
        membership: {
          id: membership.id,
          role: membership.role,
          status: membership.status,
        },
      },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthorizationDeniedError) {
      await recordAuthorizationDecision(getDatabase(), {
        action: "case.membership.grant",
        actorUserId: session.user.id,
        outcome: "denied",
        reasonCode: "case_access_denied",
        resourceId: caseId,
      });
      return Response.json({ error: "Resource unavailable" }, { status: 404 });
    }
    return Response.json(
      { error: "Membership cannot be granted" },
      { status: 400 },
    );
  }
}
