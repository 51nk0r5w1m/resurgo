import { addDocumentComment, AuthorizationDeniedError } from "@resurgo/db";
import { z } from "zod";

import { getAuth, getDatabase } from "../../../../../../../lib/auth";

const commentSchema = z.object({
  anchor: z.unknown().optional(),
  body: z.string().trim().min(1).max(4000),
  kind: z.enum(["comment", "highlight"]),
  parentCommentId: z.uuid().optional(),
  versionId: z.uuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string; documentId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = commentSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: "Invalid comment" }, { status: 400 });
  try {
    const { anchor, body, kind, parentCommentId, versionId } = parsed.data;
    const comment = await addDocumentComment(getDatabase(), {
      ...(anchor === undefined ? {} : { anchor }),
      ...(parentCommentId === undefined ? {} : { parentCommentId }),
      ...(await params),
      body,
      kind,
      versionId,
      userId: session.user.id,
    });
    return Response.json({ comment }, { status: 201 });
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
}
