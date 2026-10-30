import { createHash, randomUUID } from "node:crypto";

import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, test } from "vitest";

import { scanWithClamAv } from "./clamav";
import { documentObjectKeys } from "./keys";
import { processQuarantinedDocument } from "./processor";
import { createS3PrivateObjectStorage } from "./storage";

const required = (name: string) => {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for processing integration tests`);
  return value;
};

const storage = createS3PrivateObjectStorage({
  accessKeyId: required("GARAGE_ACCESS_KEY_ID"),
  bucket: required("GARAGE_BUCKET"),
  endpoint: required("GARAGE_ENDPOINT"),
  region: required("GARAGE_REGION"),
  secretAccessKey: required("GARAGE_SECRET_ACCESS_KEY"),
});
const identifiers = {
  caseId: randomUUID(),
  documentId: randomUUID(),
  versionId: randomUUID(),
};
const keys = documentObjectKeys(identifiers);

afterEach(async () => {
  await Promise.all(
    Object.values(keys).map((key) =>
      storage.delete(key).catch(() => undefined),
    ),
  );
});

describe("isolated document processing integration", () => {
  test("releases only a structurally valid, hash-matched, malware-scanned PDF", async () => {
    const document = await PDFDocument.create();
    document.addPage([612, 792]);
    const source = await document.save();
    const contentHash = createHash("sha256").update(source).digest("hex");
    await storage.put({
      body: source,
      contentHash,
      contentType: "application/pdf",
      key: keys.quarantine,
    });

    await processQuarantinedDocument({
      ...identifiers,
      contentHash,
      declaredMimeType: "application/pdf",
      scan: (bytes) =>
        scanWithClamAv(bytes, {
          host: process.env.CLAMAV_HOST ?? "127.0.0.1",
          port: Number(process.env.CLAMAV_PORT ?? "3310"),
        }),
      storage,
    });

    await expect(storage.get(keys.quarantine, 1024)).rejects.toThrow();
    await expect(storage.get(keys.available, 1024 * 1024)).resolves.toEqual(
      new Uint8Array(source),
    );
    const preview = await storage.get(keys.preview, 10 * 1024 * 1024);
    await expect(PDFDocument.load(preview)).resolves.toBeDefined();
  });
});
