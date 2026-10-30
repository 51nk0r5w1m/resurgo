import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import {
  createCaseWithOwner,
  createDatabase,
  createDocumentWithVersion,
  documentProcessingEvents,
  user,
} from "@resurgo/db";
import {
  documentObjectKeys,
  type PrivateObjectStorage,
} from "@resurgo/documents/worker";
import { and, desc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { PDFDocument } from "pdf-lib";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { processNextDocument } from "./worker";

const databaseUrl = process.env.DATABASE_URL;
const databaseName = `resurgo_worker_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(databaseUrl ?? "postgresql://invalid/invalid");
adminUrl.pathname = "/postgres";
const testUrl = new URL(databaseUrl ?? "postgresql://invalid/invalid");
testUrl.pathname = `/${databaseName}`;

function memoryStorage(initial: Record<string, Uint8Array>) {
  const objects = new Map(Object.entries(initial));
  const storage: PrivateObjectStorage = {
    async copy(source, destination) {
      const value = objects.get(source);
      if (!value) throw new Error("missing object");
      objects.set(destination, value);
    },
    async delete(key) {
      objects.delete(key);
    },
    async get(key, maximumBytes) {
      const value = objects.get(key);
      if (!value || value.byteLength > maximumBytes)
        throw new Error("missing object");
      return value;
    },
    async head(key) {
      const value = objects.get(key);
      if (!value) throw new Error("missing object");
      return { byteSize: value.byteLength };
    },
    async put({ body, key }) {
      objects.set(key, body);
    },
  };
  return { objects, storage };
}

describe.skipIf(!databaseUrl)("document worker state transitions", () => {
  let admin: pg.Client | undefined;
  let database: ReturnType<typeof createDatabase> | undefined;

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    database = createDatabase(testUrl.toString());
    await migrate(database.db, {
      migrationsFolder: resolve(
        import.meta.dirname,
        "../../../packages/db/drizzle",
      ),
    });
  });

  afterAll(async () => {
    await database?.pool.end();
    if (!admin) return;
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1",
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  });

  test("publishes only after processing and leaves scanner failures unavailable", async () => {
    if (!database) throw new Error("Worker test database was not initialized");
    const [owner] = await database.db
      .insert(user)
      .values({
        email: `document-worker-${randomUUID()}@synthetic.example`,
        name: "Synthetic Document Worker Owner",
      })
      .returning();
    if (!owner) throw new Error("Synthetic owner was not created");
    const { case: clientCase } = await createCaseWithOwner(database.db, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 200]);
    const source = await pdf.save();

    const first = await createDocumentWithVersion(database.db, {
      byteSize: source.byteLength,
      caseId: clientCase.id,
      classification: "financial",
      confidentiality: "financial_restricted",
      contentHash: createHash("sha256").update(source).digest("hex"),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "synthetic_worker_test",
      source: "client_upload",
      title: "Synthetic scanned statement",
      userId: owner.id,
    });
    const firstKeys = documentObjectKeys({
      caseId: clientCase.id,
      documentId: first.document.id,
      versionId: first.version.id,
    });
    const memory = memoryStorage({ [firstKeys.quarantine]: source });

    await expect(
      processNextDocument({
        database: database.db,
        scan: async () => ({ clean: true }),
        storage: memory.storage,
      }),
    ).resolves.toBe(true);
    expect(memory.objects.has(firstKeys.quarantine)).toBe(false);
    expect(memory.objects.has(firstKeys.available)).toBe(true);
    expect(memory.objects.has(firstKeys.preview)).toBe(true);

    const second = await createDocumentWithVersion(database.db, {
      byteSize: source.byteLength,
      caseId: clientCase.id,
      classification: "legal",
      confidentiality: "confidential",
      contentHash: createHash("sha256").update(source).digest("hex"),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "synthetic_worker_test",
      source: "client_upload",
      title: "Synthetic retry statement",
      userId: owner.id,
    });
    const secondKeys = documentObjectKeys({
      caseId: clientCase.id,
      documentId: second.document.id,
      versionId: second.version.id,
    });
    memory.objects.set(secondKeys.quarantine, source);
    await expect(
      processNextDocument({
        database: database.db,
        scan: async () => {
          throw new Error("synthetic scanner outage");
        },
        storage: memory.storage,
      }),
    ).resolves.toBe(true);
    const [latest] = await database.db
      .select({ status: documentProcessingEvents.status })
      .from(documentProcessingEvents)
      .where(
        and(
          eq(documentProcessingEvents.documentId, second.document.id),
          eq(documentProcessingEvents.documentVersionId, second.version.id),
        ),
      )
      .orderBy(
        desc(documentProcessingEvents.occurredAt),
        desc(documentProcessingEvents.id),
      )
      .limit(1);
    expect(latest?.status).toBe("processing");
    expect(memory.objects.has(secondKeys.quarantine)).toBe(true);
    expect(memory.objects.has(secondKeys.available)).toBe(false);
  });
});
