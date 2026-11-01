import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseEnvironment } from "@resurgo/config";
import {
  createS3PrivateObjectStorage,
  documentObjectKeys,
} from "@resurgo/documents";
import pg from "pg";

const DEMO_EMAILS = [
  "jordan.ellis.demo@resurgo.local",
  "morgan.reed.demo@resurgo.local",
  "whitney.owings.demo@resurgo.local",
] as const;
const DEMO_ORGANIZATION_SLUGS = [
  "peachtree-family-law-demo",
  "piedmont-mortgage-transition-demo",
] as const;
const SECRETS_DIRECTORY = resolve(import.meta.dirname, "../../../.secrets");
const PENDING_OBJECTS_PATH = resolve(
  SECRETS_DIRECTORY,
  "demo-reset-pending-objects.json",
);
type PendingObject = { key: string; versionId: string };

async function readPendingObjects(): Promise<PendingObject[]> {
  try {
    const value: unknown = JSON.parse(
      await readFile(PENDING_OBJECTS_PATH, "utf8"),
    );
    if (
      !Array.isArray(value) ||
      !value.every(
        (item): item is PendingObject =>
          typeof item === "object" &&
          item !== null &&
          "key" in item &&
          typeof item.key === "string" &&
          "versionId" in item &&
          typeof item.versionId === "string",
      )
    )
      throw new Error("Invalid pending demo object cleanup record");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writePendingObjects(objects: PendingObject[]) {
  await mkdir(SECRETS_DIRECTORY, { mode: 0o700, recursive: true });
  const temporaryPath = `${PENDING_OBJECTS_PATH}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(objects, null, 2)}\n`, {
    mode: 0o600,
  });
  await rename(temporaryPath, PENDING_OBJECTS_PATH);
}

function assertLocalDatabase(databaseUrl: string, nodeEnvironment: string) {
  const parsed = new URL(databaseUrl);
  if (
    nodeEnvironment === "production" ||
    !["127.0.0.1", "localhost"].includes(parsed.hostname)
  ) {
    throw new Error(
      "Synthetic demo reset is restricted to a loopback non-production database",
    );
  }
}

export async function resetSyntheticDemo() {
  const environment = parseEnvironment(process.env);
  assertLocalDatabase(environment.DATABASE_URL, environment.NODE_ENV);
  const database = new pg.Client({
    connectionString: environment.DATABASE_URL,
  });
  const storage = createS3PrivateObjectStorage({
    accessKeyId: environment.GARAGE_ACCESS_KEY_ID,
    bucket: environment.GARAGE_BUCKET,
    endpoint: environment.GARAGE_ENDPOINT,
    region: environment.GARAGE_REGION,
    secretAccessKey: environment.GARAGE_SECRET_ACCESS_KEY,
  });
  await database.connect();
  try {
    const previousPendingObjects = await readPendingObjects();
    const retryableObjects: PendingObject[] = [];
    for (const pending of previousPendingObjects) {
      const version = await database.query(
        "select 1 from resurgo.document_versions where id = $1 limit 1",
        [pending.versionId],
      );
      // A prepared cleanup record may survive a rolled-back transaction. Never
      // delete an object while its immutable version row still references it.
      if (version.rowCount) {
        retryableObjects.push(pending);
        continue;
      }
      try {
        await storage.delete(pending.key);
      } catch {
        retryableObjects.push(pending);
      }
    }
    if (retryableObjects.length > 0) {
      await writePendingObjects(retryableObjects);
      throw new Error(
        `Failed to retry ${retryableObjects.length} pending demo object deletion(s)`,
      );
    }
    if (previousPendingObjects.length > 0)
      await rm(PENDING_OBJECTS_PATH, { force: true });

    const users = await database.query<{ id: string }>(
      "select id from auth.user where email = any($1::text[])",
      [DEMO_EMAILS],
    );
    const userIds = users.rows.map(({ id }) => id);
    if (userIds.length === 0) {
      console.log("No synthetic demonstration records were present.");
    }
    const cases = await database.query<{ id: string }>(
      `select distinct c.id
         from resurgo.cases c
         left join resurgo.case_memberships cm on cm.case_id = c.id
        where c.owner_user_id = any($1::uuid[])
           or cm.user_id = any($1::uuid[])`,
      [userIds],
    );
    const caseIds = cases.rows.map(({ id }) => id);
    const versions =
      caseIds.length === 0
        ? {
            rows: [] as Array<{
              case_id: string;
              document_id: string;
              id: string;
            }>,
          }
        : await database.query<{
            case_id: string;
            document_id: string;
            id: string;
          }>(
            `select case_id, document_id, id
               from resurgo.document_versions
              where case_id = any($1::uuid[])`,
            [caseIds],
          );
    const pendingObjects = versions.rows.flatMap((version) => {
      const keys = documentObjectKeys({
        caseId: version.case_id,
        documentId: version.document_id,
        versionId: version.id,
      });
      return [keys.available, keys.preview, keys.quarantine].map((key) => ({
        key,
        versionId: version.id,
      }));
    });
    if (pendingObjects.length > 0) await writePendingObjects(pendingObjects);

    await database.query("begin");
    try {
      // Local PostgreSQL owns these schemas. Replica mode permits deletion of
      // immutable demo history while the predicates retain all unrelated rows.
      await database.query("set local session_replication_role = replica");
      if (caseIds.length > 0) {
        const caseTables = await database.query<{ table_name: string }>(
          `select table_name
             from information_schema.columns
            where table_schema = 'resurgo' and column_name = 'case_id'
            order by table_name`,
        );
        for (const { table_name: tableName } of caseTables.rows) {
          if (!/^[a-z_]+$/u.test(tableName))
            throw new Error("Unsafe table name");
          await database.query(
            `delete from resurgo."${tableName}" where case_id = any($1::uuid[])`,
            [caseIds],
          );
        }
        await database.query(
          "delete from resurgo.cases where id = any($1::uuid[])",
          [caseIds],
        );
      }
      const organizations = await database.query<{ id: string }>(
        "select id from resurgo.organizations where slug = any($1::text[])",
        [DEMO_ORGANIZATION_SLUGS],
      );
      const organizationIds = organizations.rows.map(({ id }) => id);
      if (organizationIds.length > 0) {
        await database.query(
          "delete from resurgo.organization_memberships where organization_id = any($1::uuid[])",
          [organizationIds],
        );
        await database.query(
          "delete from resurgo.organizations where id = any($1::uuid[])",
          [organizationIds],
        );
      }
      await database.query(
        "delete from resurgo.audit_events where actor_user_id = any($1::uuid[])",
        [userIds],
      );
      for (const table of ["two_factor", "session", "account"] as const) {
        await database.query(
          `delete from auth."${table}" where user_id = any($1::uuid[])`,
          [userIds],
        );
      }
      await database.query(
        "delete from auth.verification where identifier = any($1::text[])",
        [DEMO_EMAILS],
      );
      await database.query("delete from auth.user where id = any($1::uuid[])", [
        userIds,
      ]);
      await database.query("commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }
    const failedObjects: PendingObject[] = [];
    const deletionResults = await Promise.allSettled(
      pendingObjects.map(({ key }) => storage.delete(key)),
    );
    for (const [index, result] of deletionResults.entries()) {
      if (result.status === "rejected" && pendingObjects[index])
        failedObjects.push(pendingObjects[index]);
    }
    if (failedObjects.length > 0) {
      await writePendingObjects(failedObjects);
      throw new Error(
        `Database reset completed, but ${failedObjects.length} object deletion(s) require retry`,
      );
    }
    if (pendingObjects.length > 0)
      await rm(PENDING_OBJECTS_PATH, { force: true });
    await rm(
      resolve(import.meta.dirname, "../../../.secrets/demo-credentials.json"),
      {
        force: true,
      },
    );
    console.log(
      `Removed ${caseIds.length} synthetic demo case and ${userIds.length} demo identities; unrelated local records were retained.`,
    );
  } finally {
    await database.end();
  }
}

resetSyntheticDemo().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Synthetic demo reset failed",
  );
  process.exitCode = 1;
});
