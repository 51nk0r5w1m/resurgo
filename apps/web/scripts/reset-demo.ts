import { rm } from "node:fs/promises";
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
    const users = await database.query<{ id: string }>(
      "select id from auth.user where email = any($1::text[])",
      [DEMO_EMAILS],
    );
    const userIds = users.rows.map(({ id }) => id);
    if (userIds.length === 0) {
      console.log("No synthetic demonstration records were present.");
      return;
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
    for (const version of versions.rows) {
      const keys = documentObjectKeys({
        caseId: version.case_id,
        documentId: version.document_id,
        versionId: version.id,
      });
      await Promise.all([
        storage.delete(keys.available),
        storage.delete(keys.preview),
        storage.delete(keys.quarantine),
      ]);
    }

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
