import { createHash, timingSafeEqual } from "node:crypto";

import { documentObjectKeys } from "./keys";
import { createRasterizedPdfPreview } from "./preview";
import type { PrivateObjectStorage } from "./storage";
import { maximumDocumentBytes, validateDocumentStructure } from "./validation";

export class DocumentProcessingError extends Error {
  constructor(
    message: string,
    readonly failureCode:
      | "content_hash_mismatch"
      | "malformed_document"
      | "malware_detected"
      | "scanner_unavailable"
      | "storage_failure",
    readonly removeFromQuarantine: boolean,
  ) {
    super(message);
    this.name = "DocumentProcessingError";
  }
}

export async function processQuarantinedDocument(input: {
  caseId: string;
  contentHash: string;
  declaredMimeType: string;
  documentId: string;
  scan(bytes: Uint8Array): Promise<{ clean: true }>;
  storage: PrivateObjectStorage;
  versionId: string;
}) {
  const keys = documentObjectKeys(input);
  let bytes: Uint8Array;
  try {
    bytes = await input.storage.get(keys.quarantine, maximumDocumentBytes);
  } catch {
    throw new DocumentProcessingError(
      "Quarantined object could not be read",
      "storage_failure",
      false,
    );
  }
  const actualHash = createHash("sha256").update(bytes).digest();
  const expectedHash = Buffer.from(input.contentHash, "hex");
  if (
    expectedHash.byteLength !== actualHash.byteLength ||
    !timingSafeEqual(expectedHash, actualHash)
  ) {
    throw new DocumentProcessingError(
      "Quarantined object hash does not match its immutable version",
      "content_hash_mismatch",
      true,
    );
  }
  let validated: Awaited<ReturnType<typeof validateDocumentStructure>>;
  try {
    validated = await validateDocumentStructure(bytes, input.declaredMimeType);
  } catch {
    throw new DocumentProcessingError(
      "Document structure was rejected",
      "malformed_document",
      true,
    );
  }
  try {
    await input.scan(bytes);
  } catch (error) {
    const malware =
      error instanceof Error && error.message.includes("rejected the document");
    throw new DocumentProcessingError(
      malware ? "Malware was detected" : "Malware scanner was unavailable",
      malware ? "malware_detected" : "scanner_unavailable",
      malware,
    );
  }

  try {
    await input.storage.copy(keys.quarantine, keys.available);
    if (validated.format === "pdf") {
      const preview = await createRasterizedPdfPreview(bytes);
      await input.storage.put({
        body: preview,
        contentHash: createHash("sha256").update(preview).digest("hex"),
        contentType: "application/pdf",
        key: keys.preview,
      });
    }
    await input.storage.delete(keys.quarantine);
  } catch {
    throw new DocumentProcessingError(
      "Validated document could not be released",
      "storage_failure",
      false,
    );
  }
  return { format: validated.format, keys };
}
