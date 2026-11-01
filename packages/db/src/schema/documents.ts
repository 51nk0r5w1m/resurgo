import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { caseMemberships, cases } from "./collaboration";
import { discoveryOutputs } from "./discovery";
import {
  documentConfidentiality,
  documentContributorRole,
  documentContributorStatus,
  documentFormat,
  documentProcessingStatus,
  documentRequestStatus,
  documentSource,
  legalHoldAction,
  resourceClassification,
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
    archivedAt: timestamp("archived_at", { mode: "date", withTimezone: true }),
    archivedByCaseMembershipId: uuid("archived_by_case_membership_id"),
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
      columns: [table.caseId, table.archivedByCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "documents_archived_by_membership_fk",
    }).onDelete("restrict"),
    check(
      "documents_archive_state_check",
      sql`(${table.archivedAt} is null and ${table.archivedByCaseMembershipId} is null) or (${table.archivedAt} is not null and ${table.archivedByCaseMembershipId} is not null)`,
    ),
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

export const documentComments = resurgoSchema.table(
  "document_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    documentId: uuid("document_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    authorCaseMembershipId: uuid("author_case_membership_id").notNull(),
    kind: text("kind").default("comment").notNull(),
    body: text("body").notNull(),
    anchor: jsonb("anchor"),
    parentCommentId: uuid("parent_comment_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("document_comments_case_id_id_unique").on(table.caseId, table.id),
    index("document_comments_version_created_idx").on(
      table.documentVersionId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.caseId, table.documentId, table.documentVersionId],
      foreignColumns: [
        documentVersions.caseId,
        documentVersions.documentId,
        documentVersions.id,
      ],
      name: "document_comments_version_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.authorCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_comments_author_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.parentCommentId],
      foreignColumns: [table.caseId, table.id],
      name: "document_comments_parent_fk",
    }).onDelete("restrict"),
    check(
      "document_comments_kind_check",
      sql`${table.kind} in ('comment', 'highlight')`,
    ),
    check(
      "document_comments_body_check",
      sql`length(trim(${table.body})) between 1 and 4000`,
    ),
  ],
);

export const documentCommentEvents = resurgoSchema.table(
  "document_comment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    commentId: uuid("comment_id").notNull(),
    actorCaseMembershipId: uuid("actor_case_membership_id").notNull(),
    status: text("status").notNull(),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_comment_events_comment_time_idx").on(
      table.commentId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.caseId, table.commentId],
      foreignColumns: [documentComments.caseId, documentComments.id],
      name: "document_comment_events_comment_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.actorCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_comment_events_actor_fk",
    }).onDelete("restrict"),
    check(
      "document_comment_events_status_check",
      sql`${table.status} in ('open', 'resolved', 'reopened')`,
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

export const documentRequests = resurgoSchema.table(
  "document_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    caseResourceId: uuid("case_resource_id").notNull(),
    sourceDiscoveryOutputId: uuid("source_discovery_output_id"),
    requestedByCaseMembershipId: uuid(
      "requested_by_case_membership_id",
    ).notNull(),
    assignedToCaseMembershipId: uuid("assigned_to_case_membership_id"),
    classification: resourceClassification("classification").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    dueAt: timestamp("due_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("document_requests_case_id_id_unique").on(table.caseId, table.id),
    unique("document_requests_case_resource_unique").on(
      table.caseId,
      table.caseResourceId,
    ),
    index("document_requests_case_created_at_idx").on(
      table.caseId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.caseId, table.caseResourceId],
      foreignColumns: [caseResources.caseId, caseResources.id],
      name: "document_requests_case_resource_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.sourceDiscoveryOutputId, table.caseId],
      foreignColumns: [discoveryOutputs.id, discoveryOutputs.caseId],
      name: "document_requests_discovery_output_case_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.requestedByCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_requests_requester_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.assignedToCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_requests_assignee_fk",
    }).onDelete("restrict"),
    check(
      "document_requests_title_check",
      sql`length(trim(${table.title})) between 1 and 240`,
    ),
    check(
      "document_requests_description_check",
      sql`length(trim(${table.description})) between 1 and 4000`,
    ),
  ],
);

export const documentRequestEvents = resurgoSchema.table(
  "document_request_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    documentRequestId: uuid("document_request_id").notNull(),
    status: documentRequestStatus("status").notNull(),
    actorCaseMembershipId: uuid("actor_case_membership_id").notNull(),
    documentId: uuid("document_id"),
    documentVersionId: uuid("document_version_id"),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("document_request_events_request_time_idx").on(
      table.documentRequestId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.caseId, table.documentRequestId],
      foreignColumns: [documentRequests.caseId, documentRequests.id],
      name: "document_request_events_request_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.actorCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "document_request_events_actor_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.documentId, table.documentVersionId],
      foreignColumns: [
        documentVersions.caseId,
        documentVersions.documentId,
        documentVersions.id,
      ],
      name: "document_request_events_version_fk",
    }).onDelete("restrict"),
    check(
      "document_request_events_version_check",
      sql`(${table.status} in ('submitted', 'completed') and ${table.documentId} is not null and ${table.documentVersionId} is not null) or (${table.status} in ('requested', 'cancelled') and ${table.documentId} is null and ${table.documentVersionId} is null)`,
    ),
  ],
);
