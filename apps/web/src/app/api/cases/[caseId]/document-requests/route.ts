import {
  AuthorizationDeniedError,
  createDocumentRequest,
  listAuthorizedDocumentRequests,
} from "@resurgo/db";
import { z } from "zod";

import { getAuth, getDatabase } from "../../../../../lib/auth";

const requestSchema = z.object({
  classification: z.enum(["shared", "legal", "financial", "personal_support"]),
  description: z.string().trim().min(1).max(4000),
  dueAt: z.iso.datetime().optional(),
  title: z.string().trim().min(1).max(240),
});

async function principal(request: Request) {
  return getAuth().api.getSession({ headers: request.headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await principal(request);
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { caseId } = await params;
  try {
    return Response.json(
      {
        requests: await listAuthorizedDocumentRequests(getDatabase(), {
          caseId,
          userId: session.user.id,
        }),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const session = await principal(request);
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: "Invalid request" }, { status: 400 });
  const { caseId } = await params;
  try {
    const created = await createDocumentRequest(getDatabase(), {
      caseId,
      classification: parsed.data.classification,
      description: parsed.data.description,
      ...(parsed.data.dueAt ? { dueAt: new Date(parsed.data.dueAt) } : {}),
      title: parsed.data.title,
      userId: session.user.id,
    });
    return Response.json(
      { request: created },
      { headers: { "cache-control": "no-store" }, status: 201 },
    );
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
}
