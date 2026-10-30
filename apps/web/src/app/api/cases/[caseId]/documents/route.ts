import { createHash } from "node:crypto";

import {
  AuthorizationDeniedError,
  createDocumentWithVersion,
  listAuthorizedDocuments,
  recordDocumentProcessingEvent,
} from "@resurgo/db";
import {
  documentObjectKeys,
  inspectDocumentEnvelope,
  maximumDocumentBytes,
} from "@resurgo/documents";
import { z } from "zod";

import { getAuth, getDatabase } from "../../../../../lib/auth";
import {
  MultipartUploadError,
  parseBoundedDocumentUpload,
} from "../../../../../lib/multipart-upload";
import { getPrivateObjectStorage } from "../../../../../lib/storage";

export const runtime = "nodejs";

const metadataSchema = z.object({
  classification: z.enum(["shared", "legal", "financial", "personal_support"]),
  confidentiality: z.enum([
    "standard",
    "confidential",
    "attorney_client",
    "financial_restricted",
    "personal_sensitive",
  ]),
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
    const documents = await listAuthorizedDocuments(getDatabase(), {
      caseId,
      userId: session.user.id,
    });
    return Response.json(
      { documents },
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
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maximumDocumentBytes + 128 * 1024) {
    return Response.json({ error: "Upload is too large" }, { status: 413 });
  }
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
  const parsed = metadataSchema.safeParse({
    classification: upload.fields.classification,
    confidentiality: upload.fields.confidentiality,
    title: upload.fields.title,
  });
  if (!parsed.success) {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const bytes = upload.file.bytes;
  let envelope;
  try {
    envelope = inspectDocumentEnvelope(bytes, upload.file.mimeType);
  } catch {
    return Response.json({ error: "Invalid upload" }, { status: 400 });
  }
  const { caseId } = await params;
  let created;
  try {
    created = await createDocumentWithVersion(getDatabase(), {
      byteSize: bytes.byteLength,
      caseId,
      classification: parsed.data.classification,
      confidentiality: parsed.data.confidentiality,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
      format: envelope.format,
      mimeType: envelope.mimeType,
      recordInitialQuarantineEvent: false,
      retentionClass: "client_case_record",
      source: "client_upload",
      title: parsed.data.title,
      userId: session.user.id,
    });
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) throw error;
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
  const keys = documentObjectKeys({
    caseId,
    documentId: created.document.id,
    versionId: created.version.id,
  });
  try {
    await getPrivateObjectStorage().put({
      body: bytes,
      contentHash: created.version.contentHash,
      contentType: created.version.mimeType,
      key: keys.quarantine,
    });
    await recordDocumentProcessingEvent(getDatabase(), {
      caseId,
      documentId: created.document.id,
      status: "quarantined",
      userId: session.user.id,
      versionId: created.version.id,
    });
  } catch {
    await recordDocumentProcessingEvent(getDatabase(), {
      caseId,
      documentId: created.document.id,
      failureCode: "storage_failure",
      status: "rejected",
      userId: session.user.id,
      versionId: created.version.id,
    });
    return Response.json(
      { error: "Upload could not be quarantined" },
      { status: 503 },
    );
  }
  return Response.json(
    {
      document: {
        id: created.document.id,
        processingStatus: "quarantined",
        title: created.document.title,
        versionId: created.version.id,
      },
    },
    { headers: { "cache-control": "no-store" }, status: 202 },
  );
}
