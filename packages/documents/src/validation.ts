import { BlobReader, ZipReader } from "@zip.js/zip.js";
import { PDFDocument } from "pdf-lib";

export const maximumDocumentBytes = 15 * 1024 * 1024;
const maximumOoxmlEntries = 2_000;
const maximumOoxmlUncompressedBytes = 75 * 1024 * 1024;

export type ValidatedDocument = {
  format: "docx" | "pdf";
  mimeType: string;
};

export function inspectDocumentEnvelope(
  bytes: Uint8Array,
  declaredMimeType: string,
): ValidatedDocument {
  assertSize(bytes);
  if (
    declaredMimeType === "application/pdf" &&
    Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
  ) {
    return { format: "pdf", mimeType: declaredMimeType };
  }
  if (
    declaredMimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ([0x03, 0x05, 0x07] as const).includes(bytes[2] as 0x03)
  ) {
    return { format: "docx", mimeType: declaredMimeType };
  }
  throw new Error("Declared document type does not match its signature");
}

function assertSize(bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > maximumDocumentBytes) {
    throw new Error("Document size is outside the permitted range");
  }
}

async function validatePdf(bytes: Uint8Array): Promise<ValidatedDocument> {
  if (Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    throw new Error("PDF signature is invalid");
  }
  if (
    !Buffer.from(bytes.subarray(Math.max(0, bytes.byteLength - 1024)))
      .toString("latin1")
      .includes("%%EOF")
  ) {
    throw new Error("PDF end marker is missing");
  }
  await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    parseSpeed: 100,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });
  return { format: "pdf", mimeType: "application/pdf" };
}

async function validateDocx(bytes: Uint8Array): Promise<ValidatedDocument> {
  if (
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    !([0x03, 0x05, 0x07] as const).includes(bytes[2] as 0x03)
  ) {
    throw new Error("OOXML ZIP signature is invalid");
  }
  const copiedBytes = bytes.slice().buffer as ArrayBuffer;
  const reader = new ZipReader(new BlobReader(new Blob([copiedBytes])));
  try {
    const entries = await reader.getEntries();
    if (entries.length === 0 || entries.length > maximumOoxmlEntries) {
      throw new Error("OOXML entry count is outside the permitted range");
    }
    let uncompressedBytes = 0;
    const names = new Set<string>();
    for (const entry of entries) {
      if (
        entry.filename.startsWith("/") ||
        entry.filename.includes("..") ||
        entry.filename.includes("\\")
      ) {
        throw new Error("OOXML archive contains an unsafe path");
      }
      if (names.has(entry.filename)) {
        throw new Error("OOXML archive contains duplicate entry names");
      }
      if (names.has(entry.filename)) {
        throw new Error("OOXML archive contains duplicate filenames");
      }
      names.add(entry.filename);
      uncompressedBytes += entry.uncompressedSize;
      if (uncompressedBytes > maximumOoxmlUncompressedBytes) {
        throw new Error("OOXML expanded size exceeds the permitted range");
      }
    }
    if (
      !names.has("[Content_Types].xml") ||
      !names.has("word/document.xml") ||
      names.has("word/vbaProject.bin")
    ) {
      throw new Error("OOXML document structure is not permitted");
    }
  } finally {
    await reader.close();
  }
  return {
    format: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

export async function validateDocumentStructure(
  bytes: Uint8Array,
  declaredMimeType: string,
) {
  inspectDocumentEnvelope(bytes, declaredMimeType);
  const validated =
    declaredMimeType === "application/pdf"
      ? await validatePdf(bytes)
      : declaredMimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ? await validateDocx(bytes)
        : undefined;
  if (!validated || validated.mimeType !== declaredMimeType) {
    throw new Error("Document type is not permitted");
  }
  return validated;
}
