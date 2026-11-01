import { createHash, randomUUID } from "node:crypto";

import { afterEach, describe, expect, test } from "vitest";

import { documentObjectKeys } from "./keys";
import { createS3PrivateObjectStorage } from "./storage";

const garageConfiguration = {
  accessKeyId: process.env.GARAGE_ACCESS_KEY_ID,
  bucket: process.env.GARAGE_BUCKET,
  endpoint: process.env.GARAGE_ENDPOINT,
  region: process.env.GARAGE_REGION,
  secretAccessKey: process.env.GARAGE_SECRET_ACCESS_KEY,
};
const garageConfigured = Object.values(garageConfiguration).every(Boolean);
const storage = garageConfigured
  ? createS3PrivateObjectStorage(
      garageConfiguration as Record<keyof typeof garageConfiguration, string>,
    )
  : undefined;
const storageSuite = garageConfigured ? describe : describe.skip;

const keys = documentObjectKeys({
  caseId: randomUUID(),
  documentId: randomUUID(),
  versionId: randomUUID(),
});

afterEach(async () => {
  if (!storage) return;
  await Promise.all(Object.values(keys).map((key) => storage.delete(key)));
});

storageSuite("private S3-compatible storage", () => {
  test("stores, bounds, promotes, and removes an opaque quarantine object", async () => {
    if (!storage) throw new Error("Garage test storage was not initialized");
    const source = Buffer.from("Synthetic Resurgo storage fixture.");
    const contentHash = createHash("sha256").update(source).digest("hex");

    await storage.put({
      body: source,
      contentHash,
      contentType: "application/pdf",
      key: keys.quarantine,
    });
    await expect(storage.head(keys.quarantine)).resolves.toMatchObject({
      byteSize: source.byteLength,
      contentType: "application/pdf",
    });
    await expect(storage.get(keys.quarantine, 4)).rejects.toThrow(
      "Stored object exceeds byte limit",
    );
    await storage.copy(keys.quarantine, keys.available);
    await expect(storage.get(keys.available, 1024)).resolves.toEqual(
      new Uint8Array(source),
    );
    await storage.delete(keys.quarantine);
    await expect(storage.get(keys.quarantine, 1024)).rejects.toThrow();
  });

  test("does not permit unauthenticated object reads", async () => {
    if (!storage) throw new Error("Garage test storage was not initialized");
    const source = Buffer.from("Synthetic private object fixture.");
    await storage.put({
      body: source,
      contentHash: createHash("sha256").update(source).digest("hex"),
      contentType: "application/pdf",
      key: keys.quarantine,
    });

    const objectUrl = new URL(garageConfiguration.endpoint!);
    const endpointPath = objectUrl.pathname.replace(/\/$/u, "");
    objectUrl.pathname = `${endpointPath}/${garageConfiguration.bucket}/${keys.quarantine}`;
    const response = await fetch(objectUrl);
    expect([401, 403]).toContain(response.status);
  });
});
