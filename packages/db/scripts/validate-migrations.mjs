import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Client, Pool } = pg;
const sourceUrl = process.env.DATABASE_URL;

if (!sourceUrl) {
  throw new Error("DATABASE_URL is required for migration validation");
}

const databaseName = `resurgo_migration_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: adminUrl.toString() });

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);

  const pool = new Pool({ connectionString: testUrl.toString() });
  try {
    await migrate(drizzle(pool), {
      migrationsFolder: resolve(import.meta.dirname, "../drizzle"),
    });
    const result = await pool.query(`
      select exists (
        select 1
        from pg_catalog.pg_tables
        where schemaname = 'resurgo' and tablename = 'system_metadata'
      ) as relation_exists
    `);
    if (result.rows[0]?.relation_exists !== true) {
      throw new Error("Expected foundation relation was not created");
    }
  } finally {
    await pool.end();
  }
} finally {
  if (!admin.ended) {
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1",
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  }
}

console.log("Migration validation passed against a temporary empty database.");
