import { createHash, randomUUID } from "node:crypto";

import { afterEach, describe, expect, test } from "vitest";

import { documentObjectKeys } from "./keys";
import { createS3PrivateObjectStorage } from "./storage";

const required = (name: string) => {
  const value = process.env[name];
  if (!value)
    throw new Error(`${name} is required for storage integration tests`);
  return value;
};

const storage = createS3PrivateObjectStorage({
  accessKeyId: required("GARAGE_ACCESS_KEY_ID"),
  bucket: required("GARAGE_BUCKET"),
  endpoint: required("GARAGE_ENDPOINT"),
  region: required("GARAGE_REGION"),
  secretAccessKey: required("GARAGE_SECRET_ACCESS_KEY"),
});

const keys = documentObjectKeys({
  caseId: randomUUID(),
  documentId: randomUUID(),
  versionId: randomUUID(),
});

afterEach(async () => {
  await Promise.all(
    Object.values(keys).map((key) =>
      storage.delete(key).catch(() => undefined),
    ),
  );
});

describe("private S3-compatible storage", () => {
  test("stores, bounds, promotes, and removes an opaque quarantine object", async () => {
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
    const source = Buffer.from("Synthetic private object fixture.");
    await storage.put({
      body: source,
      contentHash: createHash("sha256").update(source).digest("hex"),
      contentType: "application/pdf",
      key: keys.quarantine,
    });

    const objectUrl = new URL(
      `${required("GARAGE_BUCKET")}/${keys.quarantine}`,
      `${required("GARAGE_ENDPOINT")}/`,
    );
    const response = await fetch(objectUrl);
    expect([401, 403]).toContain(response.status);
  });
});
