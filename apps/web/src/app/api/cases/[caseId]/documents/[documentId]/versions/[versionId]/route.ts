import {
  AuthorizationDeniedError,
  getAuthorizedAvailableDocumentVersion,
  recordDocumentAccessAudit,
} from "@resurgo/db";
import { documentObjectKeys, maximumDocumentBytes } from "@resurgo/documents";

import { getAuth, getDatabase } from "../../../../../../../../lib/auth";
import { getPrivateObjectStorage } from "../../../../../../../../lib/storage";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      caseId: string;
      documentId: string;
      versionId: string;
    }>;
  },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const identifiers = await params;
  const preview = new URL(request.url).searchParams.get("preview") === "true";
  try {
    const version = await getAuthorizedAvailableDocumentVersion(getDatabase(), {
      ...identifiers,
      operation: preview ? "view" : "download",
      userId: session.user.id,
    });
    const keys = documentObjectKeys(identifiers);
    const previewKey = version.format === "pdf" ? keys.preview : keys.available;
    const body = await getPrivateObjectStorage().get(
      preview ? previewKey : keys.available,
      preview ? 50 * 1024 * 1024 : maximumDocumentBytes,
    );
    // Object reads are not part of the database transaction. Revalidate after
    // the bounded read so a concurrent revocation fails before bytes leave the
    // trusted server boundary.
    await getAuthorizedAvailableDocumentVersion(getDatabase(), {
      ...identifiers,
      operation: preview ? "view" : "download",
      userId: session.user.id,
    });
    await recordDocumentAccessAudit(getDatabase(), {
      action: preview ? "document.previewed" : "document.downloaded",
      caseId: identifiers.caseId,
      userId: session.user.id,
      versionId: identifiers.versionId,
    });
    return new Response(Buffer.from(body), {
      headers: {
        "cache-control": "private, no-store, max-age=0",
        "content-disposition": `${preview ? "inline" : "attachment"}; filename="resurgo-document.${version.format}"`,
        "content-type": preview ? version.mimeType : version.mimeType,
        "content-security-policy": "default-src 'none'; sandbox",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
}
