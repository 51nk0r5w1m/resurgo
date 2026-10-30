import { BlobReader, ZipReader } from "@zip.js/zip.js";
import { XMLParser } from "fast-xml-parser";
import { PDFDocument } from "pdf-lib";

export const maximumDocumentBytes = 15 * 1024 * 1024;
const maximumOoxmlEntries = 2_000;
const maximumOoxmlUncompressedBytes = 75 * 1024 * 1024;
const maximumRequiredXmlBytes = 2 * 1024 * 1024;

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
    const requiredXml = new Map<string, Uint8Array>();
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
      names.add(entry.filename);
      if (!entry.directory) {
        const chunks: Uint8Array[] = [];
        let requiredBytes = 0;
        const captureRequired =
          entry.filename === "[Content_Types].xml" ||
          entry.filename === "word/document.xml" ||
          entry.filename.endsWith(".rels");
        await entry.getData(
          new WritableStream<Uint8Array>({
            write(chunk) {
              uncompressedBytes += chunk.byteLength;
              if (uncompressedBytes > maximumOoxmlUncompressedBytes) {
                throw new Error(
                  "OOXML expanded size exceeds the permitted range",
                );
              }
              if (captureRequired) {
                requiredBytes += chunk.byteLength;
                if (requiredBytes > maximumRequiredXmlBytes) {
                  throw new Error("Required OOXML part exceeds the size limit");
                }
                chunks.push(chunk.slice());
              }
            },
          }),
          { checkSignature: true },
        );
        if (captureRequired) {
          requiredXml.set(
            entry.filename,
            new Uint8Array(
              Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))),
            ),
          );
        }
      }
    }
    if (
      !names.has("[Content_Types].xml") ||
      !names.has("word/document.xml") ||
      names.has("word/vbaProject.bin")
    ) {
      throw new Error("OOXML document structure is not permitted");
    }
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
    let contentTypes: Record<string, unknown>;
    let documentPart: Record<string, unknown>;
    try {
      contentTypes = parser.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          requiredXml.get("[Content_Types].xml"),
        ),
      ) as Record<string, unknown>;
      documentPart = parser.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(
          requiredXml.get("word/document.xml"),
        ),
      ) as Record<string, unknown>;
    } catch {
      throw new Error("Required OOXML parts are not valid UTF-8 XML");
    }
    const types = contentTypes.Types as
      { Override?: unknown | unknown[] } | undefined;
    const overrides = Array.isArray(types?.Override)
      ? types.Override
      : types?.Override
        ? [types.Override]
        : [];
    const declaresMainDocument = overrides.some(
      (override) =>
        typeof override === "object" &&
        override !== null &&
        "@_PartName" in override &&
        override["@_PartName"] === "/word/document.xml" &&
        "@_ContentType" in override &&
        override["@_ContentType"] ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
    );
    if (!declaresMainDocument || !("document" in documentPart)) {
      throw new Error("Required OOXML parts do not describe a DOCX document");
    }
    for (const [name, bytes] of requiredXml) {
      if (!name.endsWith(".rels")) continue;
      let relationships: Record<string, unknown>;
      try {
        relationships = parser.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        ) as Record<string, unknown>;
      } catch {
        throw new Error("OOXML relationship part is not valid UTF-8 XML");
      }
      const root = relationships.Relationships as
        { Relationship?: unknown | unknown[] } | undefined;
      const entries = Array.isArray(root?.Relationship)
        ? root.Relationship
        : root?.Relationship
          ? [root.Relationship]
          : [];
      if (
        entries.some(
          (relationship) =>
            typeof relationship === "object" &&
            relationship !== null &&
            "@_TargetMode" in relationship &&
            String(relationship["@_TargetMode"]).toLowerCase() === "external",
        )
      ) {
        throw new Error("External OOXML relationships are not permitted");
      }
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
