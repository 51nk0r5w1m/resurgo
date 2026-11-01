import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const packageRequire = createRequire(resolve("packages/db/package.json"));
const pg = packageRequire("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
if (
  process.env.NODE_ENV === "production" ||
  !["127.0.0.1", "localhost"].includes(parsed.hostname)
) {
  throw new Error(
    "Reset isolation test requires a loopback non-production database",
  );
}

const database = new pg.Client({ connectionString: databaseUrl });
const marker = randomUUID();
let userId;
let caseId;
await database.connect();
try {
  await database.query(
    "delete from auth.user where email like 'reset-isolation-%@synthetic.example'",
  );
  const user = await database.query(
    `insert into auth.user (name, email, email_verified)
     values ('Synthetic reset isolation user', $1, true)
     returning id`,
    [`reset-isolation-${marker}@synthetic.example`],
  );
  userId = user.rows[0].id;
  await database.query("begin");
  try {
    await database.query("set constraints all deferred");
    const clientCase = await database.query(
      `insert into resurgo.cases (owner_user_id, created_by_user_id, jurisdiction_code)
       values ($1, $1, 'GA-FULTON-SUPERIOR')
       returning id`,
      [userId],
    );
    caseId = clientCase.rows[0].id;
    await database.query(
      `insert into resurgo.case_memberships
         (case_id, user_id, role, status, valid_from)
       values ($1, $2, 'owner', 'active', now())`,
      [caseId, userId],
    );
    await database.query("commit");
  } catch (error) {
    await database.query("rollback");
    throw error;
  }

  const reset = spawnSync("pnpm", ["demo:reset"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (reset.status !== 0) throw new Error("Scoped demo reset failed");
  const retained = await database.query(
    "select id from resurgo.cases where id = $1 and owner_user_id = $2",
    [caseId, userId],
  );
  if (retained.rowCount !== 1) {
    throw new Error("Scoped demo reset deleted an unrelated development case");
  }
  console.log("Demo reset retained the unrelated synthetic development case.");
} finally {
  if (userId) {
    await database.query("begin");
    try {
      await database.query("set local session_replication_role = replica");
      if (caseId) {
        await database.query(
          "delete from resurgo.case_memberships where case_id = $1",
          [caseId],
        );
        await database.query("delete from resurgo.cases where id = $1", [
          caseId,
        ]);
      }
      await database.query("delete from auth.user where id = $1", [userId]);
      await database.query("commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }
  }
  await database.end();
}
