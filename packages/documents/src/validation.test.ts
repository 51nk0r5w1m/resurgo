import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { documentObjectKeys } from "./keys";
import { createRasterizedPdfPreview } from "./preview";
import { validateDocumentStructure } from "./validation";

async function syntheticPdf() {
  const document = await PDFDocument.create();
  document.addPage([300, 200]);
  return document.save();
}

async function syntheticDocx(extra?: { name: string; content: string }) {
  const writer = new ZipWriter(new BlobWriter());
  await writer.add(
    "[Content_Types].xml",
    new TextReader(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
  );
  await writer.add(
    "word/document.xml",
    new TextReader(
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>',
    ),
  );
  if (extra) await writer.add(extra.name, new TextReader(extra.content));
  return new Uint8Array(await (await writer.close()).arrayBuffer());
}

async function syntheticDocxWithDuplicateEntry() {
  const bytes = Buffer.from(
    await syntheticDocx({
      name: "word/conflict.xml",
      content: "<w:document>conflicting duplicate</w:document>",
    }),
  );
  const sourceName = Buffer.from("word/conflict.xml");
  const duplicateName = Buffer.from("word/document.xml");
  let offset = bytes.indexOf(sourceName);
  while (offset >= 0) {
    duplicateName.copy(bytes, offset);
    offset = bytes.indexOf(sourceName, offset + sourceName.length);
  }
  return new Uint8Array(bytes);
}

async function syntheticDocxWithInvalidRequiredParts() {
  const writer = new ZipWriter(new BlobWriter());
  await writer.add(
    "[Content_Types].xml",
    new TextReader("synthetic non-XML content"),
  );
  await writer.add(
    "word/document.xml",
    new TextReader("synthetic non-XML document"),
  );
  return new Uint8Array(await (await writer.close()).arrayBuffer());
}

describe("document structural validation", () => {
  it("accepts a synthetic PDF and native DOCX", async () => {
    await expect(
      validateDocumentStructure(await syntheticPdf(), "application/pdf"),
    ).resolves.toMatchObject({ format: "pdf" });
    await expect(
      validateDocumentStructure(
        await syntheticDocx(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).resolves.toMatchObject({ format: "docx" });
  });

  it("creates a raster-only PDF preview with the same page count", async () => {
    const source = await syntheticPdf();
    const preview = await createRasterizedPdfPreview(source);
    const parsed = await PDFDocument.load(preview);

    expect(parsed.getPageCount()).toBe(1);
    expect(preview.byteLength).toBeGreaterThan(0);
  });

  it("rejects a preview before allocating beyond the pixel budget", async () => {
    const source = await syntheticPdf();
    await expect(
      createRasterizedPdfPreview(source, { maximumPixelsPerPage: 1_000 }),
    ).rejects.toThrow("PDF page exceeds the preview pixel limit");
  });

  it("rejects malformed, traversal, and macro-enabled OOXML", async () => {
    await expect(
      validateDocumentStructure(
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
        "application/pdf",
      ),
    ).rejects.toThrow();
    await expect(
      validateDocumentStructure(
        await syntheticDocx({ name: "../escape.xml", content: "synthetic" }),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toThrow(/unsafe (filename|path)/iu);
    await expect(
      validateDocumentStructure(
        await syntheticDocx({
          name: "word/vbaProject.bin",
          content: "synthetic macro fixture",
        }),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toThrow(/not permitted/u);
    await expect(
      validateDocumentStructure(
        await syntheticDocxWithDuplicateEntry(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toThrow(/duplicate entry/u);
    await expect(
      validateDocumentStructure(
        await syntheticDocxWithInvalidRequiredParts(),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).rejects.toThrow(/Required OOXML parts/u);
  });

  it("derives only opaque, server-owned private object keys", () => {
    expect(
      documentObjectKeys({
        caseId: "10000000-0000-4000-8000-000000000001",
        documentId: "20000000-0000-4000-8000-000000000002",
        versionId: "30000000-0000-4000-8000-000000000003",
      }).quarantine,
    ).toBe(
      "quarantine/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/30000000-0000-4000-8000-000000000003/source",
    );
    expect(() =>
      documentObjectKeys({
        caseId: "../other-case",
        documentId: "document",
        versionId: "version",
      }),
    ).toThrow();
  });
});
