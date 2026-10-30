import {
  archiveDocument,
  AuthorizationDeniedError,
  getAuthorizedDocumentDetail,
} from "@resurgo/db";

import { getAuth, getDatabase } from "../../../../../../lib/auth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ caseId: string; documentId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const detail = await getAuthorizedDocumentDetail(getDatabase(), {
      ...(await params),
      userId: session.user.id,
    });
    return Response.json(detail, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ caseId: string; documentId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    await archiveDocument(getDatabase(), {
      ...(await params),
      userId: session.user.id,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
}
