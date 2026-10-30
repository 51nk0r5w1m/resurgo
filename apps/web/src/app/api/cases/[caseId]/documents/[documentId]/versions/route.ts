import { createHash } from "node:crypto";

import {
  addDocumentVersion,
  AuthorizationDeniedError,
  recordDocumentProcessingEvent,
} from "@resurgo/db";
import {
  documentObjectKeys,
  inspectDocumentEnvelope,
  maximumDocumentBytes,
} from "@resurgo/documents";

import { getAuth, getDatabase } from "../../../../../../../lib/auth";
import {
  MultipartUploadError,
  parseBoundedDocumentUpload,
} from "../../../../../../../lib/multipart-upload";
import { getPrivateObjectStorage } from "../../../../../../../lib/storage";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string; documentId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  let upload;
  try {
    upload = await parseBoundedDocumentUpload(request, maximumDocumentBytes);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof MultipartUploadError && error.kind === "too_large"
            ? "Upload is too large"
            : "Invalid upload",
      },
      {
        status:
          error instanceof MultipartUploadError && error.kind === "too_large"
            ? 413
            : 400,
      },
    );
  }
  let envelope;
  try {
    envelope = inspectDocumentEnvelope(upload.file.bytes, upload.file.mimeType);
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const identifiers = await params;
  let version;
  try {
    version = await addDocumentVersion(getDatabase(), {
      byteSize: upload.file.bytes.byteLength,
      contentHash: createHash("sha256").update(upload.file.bytes).digest("hex"),
      format: envelope.format,
      mimeType: envelope.mimeType,
      recordInitialQuarantineEvent: false,
      source: "client_upload",
      userId: session.user.id,
      ...identifiers,
    });
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
  const keys = documentObjectKeys({ ...identifiers, versionId: version.id });
  try {
    await getPrivateObjectStorage().put({
      body: upload.file.bytes,
      contentHash: version.contentHash,
      contentType: version.mimeType,
      key: keys.quarantine,
    });
    await recordDocumentProcessingEvent(getDatabase(), {
      ...identifiers,
      status: "quarantined",
      userId: session.user.id,
      versionId: version.id,
    });
  } catch {
    await recordDocumentProcessingEvent(getDatabase(), {
      ...identifiers,
      failureCode: "storage_failure",
      status: "rejected",
      userId: session.user.id,
      versionId: version.id,
    });
    return Response.json(
      { error: "Upload could not be quarantined" },
      { status: 503 },
    );
  }
  return Response.json(
    {
      version: {
        id: version.id,
        processingStatus: "quarantined",
        versionNumber: version.versionNumber,
      },
    },
    { status: 202 },
  );
}
