import {
  authorizeDocumentDisclosure,
  AuthorizationDeniedError,
  revokeDocumentDisclosure,
} from "@resurgo/db";
import { z } from "zod";

import { getAuth, getDatabase } from "../../../../../lib/auth";

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("authorize"),
    documentId: z.uuid(),
    operations: z.array(z.enum(["view", "download", "contribute"])).min(1),
    purpose: z.string().trim().min(3).max(1000),
    recipientCaseMembershipId: z.uuid(),
  }),
  z.object({
    action: z.literal("revoke"),
    documentId: z.uuid(),
    recipientCaseMembershipId: z.uuid(),
  }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { caseId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(caseId).success || !parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    if (parsed.data.action === "authorize") {
      const result = await authorizeDocumentDisclosure(getDatabase(), {
        caseId,
        documentId: parsed.data.documentId,
        operations: parsed.data.operations,
        purpose: parsed.data.purpose,
        recipientCaseMembershipId: parsed.data.recipientCaseMembershipId,
        userId: session.user.id,
      });
      return Response.json(
        { consentIds: result.consents.map(({ id }) => id) },
        { status: 201, headers: { "cache-control": "no-store" } },
      );
    }
    await revokeDocumentDisclosure(getDatabase(), {
      caseId,
      documentId: parsed.data.documentId,
      recipientCaseMembershipId: parsed.data.recipientCaseMembershipId,
      userId: session.user.id,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AuthorizationDeniedError
            ? "Resource unavailable"
            : "Disclosure could not be updated",
      },
      { status: error instanceof AuthorizationDeniedError ? 404 : 409 },
    );
  }
}
