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
let adminConnected = false;
let databaseCreated = false;
let pool;
let primaryError;

try {
  await admin.connect();
  adminConnected = true;
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  databaseCreated = true;

  pool = new Pool({ connectionString: testUrl.toString() });
  await migrate(drizzle(pool), {
    migrationsFolder: resolve(import.meta.dirname, "../drizzle"),
  });
  const expectedRelations = [
    ["auth", "account"],
    ["auth", "rate_limit"],
    ["auth", "session"],
    ["auth", "two_factor"],
    ["auth", "user"],
    ["auth", "verification"],
    ["resurgo", "audit_events"],
    ["resurgo", "case_memberships"],
    ["resurgo", "case_resources"],
    ["resurgo", "cases"],
    ["resurgo", "disclosure_consents"],
    ["resurgo", "discovery_answers"],
    ["resurgo", "discovery_sessions"],
    ["resurgo", "document_contributors"],
    ["resurgo", "document_legal_hold_events"],
    ["resurgo", "document_processing_events"],
    ["resurgo", "document_request_events"],
    ["resurgo", "document_requests"],
    ["resurgo", "document_versions"],
    ["resurgo", "documents"],
    ["resurgo", "jurisdictions"],
    ["resurgo", "organization_memberships"],
    ["resurgo", "organizations"],
    ["resurgo", "professional_review_acknowledgements"],
    ["resurgo", "professional_review_evidence"],
    ["resurgo", "professional_review_revisions"],
    ["resurgo", "professional_review_statements"],
    ["resurgo", "professional_reviews"],
    ["resurgo", "recommendations"],
    ["resurgo", "resource_grants"],
    ["resurgo", "roadmap_items"],
    ["resurgo", "system_metadata"],
  ];
  const relations = await pool.query(`
      select schemaname, tablename
      from pg_catalog.pg_tables
      where schemaname in ('auth', 'resurgo')
      order by schemaname, tablename
    `);
  const actualRelations = relations.rows.map((row) => [
    row.schemaname,
    row.tablename,
  ]);
  if (JSON.stringify(actualRelations) !== JSON.stringify(expectedRelations)) {
    throw new Error("Clean migration did not create the expected relations");
  }

  const authColumns = await pool.query(`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'auth'
      order by table_name, ordinal_position
    `);
  const expectedAuthColumns = {
    account: [
      "id",
      "user_id",
      "account_id",
      "provider_id",
      "access_token",
      "refresh_token",
      "access_token_expires_at",
      "refresh_token_expires_at",
      "scope",
      "id_token",
      "password",
      "created_at",
      "updated_at",
    ],
    rate_limit: ["id", "key", "count", "last_request"],
    session: [
      "id",
      "user_id",
      "token",
      "expires_at",
      "ip_address",
      "user_agent",
      "created_at",
      "updated_at",
    ],
    two_factor: [
      "id",
      "user_id",
      "secret",
      "backup_codes",
      "verified",
      "failed_verification_count",
      "locked_until",
    ],
    user: [
      "id",
      "name",
      "email",
      "email_verified",
      "image",
      "created_at",
      "updated_at",
      "two_factor_enabled",
    ],
    verification: [
      "id",
      "identifier",
      "value",
      "expires_at",
      "created_at",
      "updated_at",
    ],
  };
  const actualAuthColumns = Object.fromEntries(
    Object.keys(expectedAuthColumns).map((tableName) => [
      tableName,
      authColumns.rows
        .filter((row) => row.table_name === tableName)
        .map((row) => row.column_name),
    ]),
  );
  if (
    JSON.stringify(actualAuthColumns) !== JSON.stringify(expectedAuthColumns)
  ) {
    throw new Error(
      "Better Auth core schema columns differ from the B1 contract",
    );
  }

  const triggers = await pool.query(`
      select trigger_name
      from information_schema.triggers
      where trigger_schema = 'resurgo'
      order by trigger_name
    `);
  const triggerNames = triggers.rows.map((row) => row.trigger_name);
  for (const expectedTrigger of [
    "audit_events_append_only",
    "case_memberships_verified_pilot_professional_check",
    "case_memberships_preserve_active_owner_check",
    "cases_enabled_pilot_jurisdiction_check",
    "cases_active_owner_membership_check",
    "document_legal_hold_events_immutable",
    "document_processing_events_immutable",
    "document_request_events_immutable",
    "document_versions_immutable",
    "professional_review_acknowledgements_immutable",
    "professional_review_acknowledgement_attorney_enforced",
    "professional_review_evidence_immutable",
    "professional_review_revisions_immutable",
    "professional_review_revision_lineage_enforced",
    "professional_review_statements_immutable",
    "resource_grants_case_owner_basis_check",
  ]) {
    if (!triggerNames.includes(expectedTrigger)) {
      throw new Error(
        `Expected migration trigger ${expectedTrigger} was absent`,
      );
    }
  }

  const jurisdictions = await pool.query(`
      select code, enabled
      from resurgo.jurisdictions
      order by code
    `);
  const expectedJurisdictions = [
    { code: "GA-DEKALB-SUPERIOR", enabled: true },
    { code: "GA-FULTON-SUPERIOR", enabled: true },
  ];
  if (
    JSON.stringify(jurisdictions.rows) !== JSON.stringify(expectedJurisdictions)
  ) {
    throw new Error(
      "Clean migration did not seed only the pilot jurisdictions",
    );
  }
} catch (error) {
  primaryError = error;
}

const cleanupErrors = [];
if (pool) {
  try {
    await pool.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
}
if (adminConnected && !admin.ended) {
  if (databaseCreated) {
    try {
      await admin.query(
        "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1",
        [databaseName],
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  try {
    await admin.end();
  } catch (error) {
    cleanupErrors.push(error);
  }
}

if (primaryError) {
  if (cleanupErrors.length > 0) {
    console.error(
      `Migration cleanup encountered ${cleanupErrors.length} error(s); preserving the original validation failure.`,
    );
  }
  throw primaryError;
}
if (cleanupErrors.length > 0) {
  throw new AggregateError(
    cleanupErrors,
    "Migration validation passed, but temporary database cleanup failed",
  );
}

console.log("Migration validation passed against a temporary empty database.");
