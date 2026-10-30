import { createHash } from "node:crypto";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { documentObjectKeys } from "./keys";
import { processQuarantinedDocument } from "./processor";
import type { PrivateObjectStorage } from "./storage";

function memoryStorage(initial: Record<string, Uint8Array>) {
  const objects = new Map(Object.entries(initial));
  const storage: PrivateObjectStorage = {
    async copy(source, destination) {
      const value = objects.get(source);
      if (!value) throw new Error("missing");
      objects.set(destination, value);
    },
    async delete(key) {
      objects.delete(key);
    },
    async get(key, maximumBytes) {
      const value = objects.get(key);
      if (!value || value.byteLength > maximumBytes) throw new Error("missing");
      return value;
    },
    async head(key) {
      const value = objects.get(key);
      if (!value) throw new Error("missing");
      return { byteSize: value.byteLength };
    },
    async put({ body, key }) {
      objects.set(key, body);
    },
  };
  return { objects, storage };
}

const identifiers = {
  caseId: "10000000-0000-4000-8000-000000000001",
  documentId: "20000000-0000-4000-8000-000000000002",
  versionId: "30000000-0000-4000-8000-000000000003",
};

async function syntheticPdf() {
  const document = await PDFDocument.create();
  document.addPage([200, 100]);
  return document.save();
}

describe("quarantined document processor", () => {
  it("releases and previews content only after structural and malware checks", async () => {
    const source = await syntheticPdf();
    const keys = documentObjectKeys(identifiers);
    const { objects, storage } = memoryStorage({ [keys.quarantine]: source });
    let scanned = false;

    await processQuarantinedDocument({
      ...identifiers,
      contentHash: createHash("sha256").update(source).digest("hex"),
      declaredMimeType: "application/pdf",
      scan: async () => {
        expect(objects.has(keys.available)).toBe(false);
        scanned = true;
        return { clean: true };
      },
      storage,
    });

    expect(scanned).toBe(true);
    expect(objects.has(keys.quarantine)).toBe(false);
    expect(objects.has(keys.available)).toBe(true);
    expect(objects.has(keys.preview)).toBe(true);
  });

  it("cannot bypass quarantine when scanning fails", async () => {
    const source = await syntheticPdf();
    const keys = documentObjectKeys(identifiers);
    const { objects, storage } = memoryStorage({ [keys.quarantine]: source });

    await expect(
      processQuarantinedDocument({
        ...identifiers,
        contentHash: createHash("sha256").update(source).digest("hex"),
        declaredMimeType: "application/pdf",
        scan: async () => {
          throw new Error("scanner offline");
        },
        storage,
      }),
    ).rejects.toMatchObject({
      failureCode: "scanner_unavailable",
      removeFromQuarantine: false,
    });
    expect(objects.has(keys.quarantine)).toBe(true);
    expect(objects.has(keys.available)).toBe(false);
    expect(objects.has(keys.preview)).toBe(false);
  });
});
