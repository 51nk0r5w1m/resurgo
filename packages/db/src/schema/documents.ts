import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  foreignKey,
  index,
  integer,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { caseMemberships, cases } from "./collaboration";
import {
  documentConfidentiality,
  documentContributorRole,
  documentContributorStatus,
  documentFormat,
  documentProcessingStatus,
  documentSource,
  legalHoldAction,
} from "./enums";
import { caseResources } from "./resources";
import { resurgoSchema } from "./system";

export const documents = resurgoSchema.table(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    caseResourceId: uuid("case_resource_id").notNull(),
    ownerCaseMembershipId: uuid("owner_case_membership_id").notNull(),
    title: text("title").notNull(),
    format: documentFormat("format").notNull(),
    confidentiality: documentConfidentiality("confidentiality").notNull(),
    retentionClass: text("retention_class").notNull(),
    retainUntil: timestamp("retain_until", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("documents_case_id_id_unique").on(table.caseId, table.id),
    unique("documents_case_resource_unique").on(
      table.caseId,
      table.caseResourceId,
    ),
    index("documents_case_created_at_idx").on(table.caseId, table.createdAt),
    foreignKey({
      columns: [table.caseId, table.caseResourceId],
      foreignColumns: [caseResources.caseId, caseResources.id],
      name: "documents_case_resource_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.ownerCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "documents_owner_membership_fk",
    }).onDelete("restrict"),
    check(
      "documents_title_check",
      sql`length(trim(${table.title})) between 1 and 240`,
    ),
    check(
      "documents_retention_class_check",
      sql`${table.retentionClass} ~ '^[a-z][a-z0-9_]{1,63}$'`,
    ),
  ],
);

export const documentVersions = resurgoSchema.table(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    documentId: uuid("document_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    mimeType: text("mime_type").notNull(),
    source: documentSource("source").notNull(),
    sourceReference: text("source_reference"),
    createdByCaseMembershipId: uuid("created_by_case_membership_id").notNull(),
    supersedesVersionId: uuid("supersedes_version_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("document_versions_case_document_version_unique").on(
      table.caseId,
      table.documentId,
      table.versionNumber,
    ),
    unique("document_versions_case_document_id_unique").on(
      table.caseId,
      table.documentId,
      table.id,
    ),
    index("document_versions_document_created_at_idx").on(
      table.documentId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.caseId, table.documentId],
      foreignColumns: [documents.caseId, documents.id],
      name: "document_versions_document_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.createdByCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_versions_creator_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.documentId, table.supersedesVersionId],
      foreignColumns: [table.caseId, table.documentId, table.id],
      name: "document_versions_supersedes_same_document_fk",
    }).onDelete("restrict"),
    check("document_versions_number_check", sql`${table.versionNumber} > 0`),
    check("document_versions_size_check", sql`${table.byteSize} > 0`),
    check(
      "document_versions_hash_check",
      sql`${table.contentHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "document_versions_mime_check",
      sql`${table.mimeType} in ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')`,
    ),
    check(
      "document_versions_lineage_check",
      sql`(${table.versionNumber} = 1 and ${table.supersedesVersionId} is null) or (${table.versionNumber} > 1 and ${table.supersedesVersionId} is not null)`,
    ),
  ],
);

export const documentProcessingEvents = resurgoSchema.table(
  "document_processing_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    documentId: uuid("document_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    status: documentProcessingStatus("status").notNull(),
    failureCode: text("failure_code"),
    actorCaseMembershipId: uuid("actor_case_membership_id"),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_processing_events_version_time_idx").on(
      table.documentVersionId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.caseId, table.documentId, table.documentVersionId],
      foreignColumns: [
        documentVersions.caseId,
        documentVersions.documentId,
        documentVersions.id,
      ],
      name: "document_processing_events_version_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.actorCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_processing_events_actor_fk",
    }).onDelete("restrict"),
    check(
      "document_processing_events_failure_check",
      sql`(${table.status} = 'rejected' and ${table.failureCode} is not null) or (${table.status} <> 'rejected' and ${table.failureCode} is null)`,
    ),
  ],
);

export const documentContributors = resurgoSchema.table(
  "document_contributors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    documentId: uuid("document_id").notNull(),
    caseMembershipId: uuid("case_membership_id").notNull(),
    role: documentContributorRole("role").notNull(),
    status: documentContributorStatus("status").default("active").notNull(),
    grantedAt: timestamp("granted_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("document_contributors_active_scope_unique")
      .on(table.documentId, table.caseMembershipId, table.role)
      .where(sql`${table.status} = 'active'`),
    index("document_contributors_membership_status_idx").on(
      table.caseMembershipId,
      table.status,
    ),
    foreignKey({
      columns: [table.caseId, table.documentId],
      foreignColumns: [documents.caseId, documents.id],
      name: "document_contributors_document_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.caseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_contributors_membership_fk",
    }).onDelete("restrict"),
    check(
      "document_contributors_revoked_check",
      sql`(${table.status} = 'revoked' and ${table.revokedAt} is not null) or (${table.status} = 'active' and ${table.revokedAt} is null)`,
    ),
  ],
);

export const documentLegalHoldEvents = resurgoSchema.table(
  "document_legal_hold_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    documentId: uuid("document_id").notNull(),
    action: legalHoldAction("action").notNull(),
    reasonCode: text("reason_code").notNull(),
    actorCaseMembershipId: uuid("actor_case_membership_id").notNull(),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_legal_hold_document_time_idx").on(
      table.documentId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.caseId, table.documentId],
      foreignColumns: [documents.caseId, documents.id],
      name: "document_legal_hold_document_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.actorCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_legal_hold_actor_membership_fk",
    }).onDelete("restrict"),
    check(
      "document_legal_hold_reason_check",
      sql`${table.reasonCode} ~ '^[a-z][a-z0-9_]{1,63}$'`,
    ),
  ],
);
