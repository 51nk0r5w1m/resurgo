import {
  AuthorizationDeniedError,
  transitionDocumentRequest,
} from "@resurgo/db";
import { z } from "zod";

import { getAuth, getDatabase } from "../../../../../../lib/auth";

const transitionSchema = z.discriminatedUnion("status", [
  z.object({
    documentId: z.uuid(),
    documentVersionId: z.uuid(),
    status: z.literal("submitted"),
  }),
  z.object({
    documentId: z.uuid(),
    documentVersionId: z.uuid(),
    status: z.literal("completed"),
  }),
  z.object({ status: z.literal("cancelled") }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string; requestId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = transitionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: "Invalid request" }, { status: 400 });
  const identifiers = await params;
  try {
    const event = await transitionDocumentRequest(getDatabase(), {
      caseId: identifiers.caseId,
      documentRequestId: identifiers.requestId,
      ...(parsed.data.status === "cancelled"
        ? {}
        : {
            documentId: parsed.data.documentId,
            documentVersionId: parsed.data.documentVersionId,
          }),
      status: parsed.data.status,
      userId: session.user.id,
    });
    return Response.json(
      { event },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthorizationDeniedError) {
      return Response.json({ error: "Resource unavailable" }, { status: 404 });
    }
    return Response.json(
      { error: "Request state could not be changed" },
      { status: 409 },
    );
  }
}
