import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { caseMemberships, cases } from "./collaboration";
import { discoveryOutputs } from "./discovery";
import { documentVersions } from "./documents";
import {
  professionalReviewStatus,
  professionalReviewSubject,
  reviewAcknowledgementAction,
  reviewConditionStatus,
  reviewStatementType,
} from "./enums";
import { caseResources } from "./resources";
import { resurgoSchema } from "./system";

export const professionalReviews = resurgoSchema.table(
  "professional_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    caseResourceId: uuid("case_resource_id").notNull(),
    sourceDiscoveryOutputId: uuid("source_discovery_output_id"),
    subjectType: professionalReviewSubject("subject_type").notNull(),
    subjectResourceId: uuid("subject_resource_id"),
    responsibleCaseMembershipId: uuid(
      "responsible_case_membership_id",
    ).notNull(),
    createdByCaseMembershipId: uuid("created_by_case_membership_id").notNull(),
    supersedesReviewId: uuid("supersedes_review_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("professional_reviews_case_id_id_unique").on(table.caseId, table.id),
    index("professional_reviews_case_responsible_idx").on(
      table.caseId,
      table.responsibleCaseMembershipId,
    ),
    unique("professional_reviews_case_resource_unique").on(
      table.caseId,
      table.caseResourceId,
    ),
    foreignKey({
      columns: [table.caseId, table.caseResourceId],
      foreignColumns: [caseResources.caseId, caseResources.id],
      name: "professional_reviews_case_resource_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.sourceDiscoveryOutputId, table.caseId],
      foreignColumns: [discoveryOutputs.id, discoveryOutputs.caseId],
      name: "professional_reviews_discovery_output_case_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.subjectResourceId],
      foreignColumns: [caseResources.caseId, caseResources.id],
      name: "professional_reviews_subject_resource_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.responsibleCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "professional_reviews_responsible_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.createdByCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "professional_reviews_creator_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.supersedesReviewId],
      foreignColumns: [table.caseId, table.id],
      name: "professional_reviews_supersedes_same_case_fk",
    }).onDelete("restrict"),
  ],
);

export const professionalReviewRevisions = resurgoSchema.table(
  "professional_review_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    professionalReviewId: uuid("professional_review_id").notNull(),
    revision: integer("revision").notNull(),
    status: professionalReviewStatus("status").notNull(),
    decisionContext: text("decision_context").notNull(),
    reviewScope: text("review_scope").notNull(),
    createdByCaseMembershipId: uuid("created_by_case_membership_id").notNull(),
    supersedesRevisionId: uuid("supersedes_revision_id"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("professional_review_revisions_case_review_revision_unique").on(
      table.caseId,
      table.professionalReviewId,
      table.revision,
    ),
    unique("professional_review_revisions_case_review_id_unique").on(
      table.caseId,
      table.professionalReviewId,
      table.id,
    ),
    index("professional_review_revisions_review_time_idx").on(
      table.professionalReviewId,
      table.createdAt,
    ),
    foreignKey({
      columns: [table.caseId, table.professionalReviewId],
      foreignColumns: [professionalReviews.caseId, professionalReviews.id],
      name: "professional_review_revisions_review_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.createdByCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "professional_review_revisions_creator_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [
        table.caseId,
        table.professionalReviewId,
        table.supersedesRevisionId,
      ],
      foreignColumns: [table.caseId, table.professionalReviewId, table.id],
      name: "professional_review_revisions_supersedes_same_review_fk",
    }).onDelete("restrict"),
    check(
      "professional_review_revisions_number_check",
      sql`${table.revision} > 0`,
    ),
    check(
      "professional_review_revisions_lineage_check",
      sql`(${table.revision} = 1 and ${table.supersedesRevisionId} is null) or (${table.revision} > 1 and ${table.supersedesRevisionId} is not null)`,
    ),
    check(
      "professional_review_revisions_context_check",
      sql`length(trim(${table.decisionContext})) between 1 and 2000`,
    ),
    check(
      "professional_review_revisions_scope_check",
      sql`length(trim(${table.reviewScope})) between 1 and 4000`,
    ),
  ],
);

export const professionalReviewStatements = resurgoSchema.table(
  "professional_review_statements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    professionalReviewId: uuid("professional_review_id").notNull(),
    reviewRevisionId: uuid("review_revision_id").notNull(),
    type: reviewStatementType("type").notNull(),
    body: text("body").notNull(),
    conditionStatus: reviewConditionStatus("condition_status"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("professional_review_statements_revision_idx").on(
      table.reviewRevisionId,
    ),
    foreignKey({
      columns: [
        table.caseId,
        table.professionalReviewId,
        table.reviewRevisionId,
      ],
      foreignColumns: [
        professionalReviewRevisions.caseId,
        professionalReviewRevisions.professionalReviewId,
        professionalReviewRevisions.id,
      ],
      name: "professional_review_statements_revision_fk",
    }).onDelete("restrict"),
    check(
      "professional_review_statements_condition_check",
      sql`(${table.type} = 'outstanding_condition' and ${table.conditionStatus} is not null) or (${table.type} <> 'outstanding_condition' and ${table.conditionStatus} is null)`,
    ),
    check(
      "professional_review_statements_body_check",
      sql`length(trim(${table.body})) between 1 and 8000`,
    ),
  ],
);

export const professionalReviewEvidence = resurgoSchema.table(
  "professional_review_evidence",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    professionalReviewId: uuid("professional_review_id").notNull(),
    reviewRevisionId: uuid("review_revision_id").notNull(),
    documentId: uuid("document_id").notNull(),
    documentVersionId: uuid("document_version_id").notNull(),
    purpose: text("purpose").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("professional_review_evidence_revision_version_unique").on(
      table.reviewRevisionId,
      table.documentVersionId,
    ),
    index("professional_review_evidence_document_version_idx").on(
      table.documentVersionId,
    ),
    foreignKey({
      columns: [
        table.caseId,
        table.professionalReviewId,
        table.reviewRevisionId,
      ],
      foreignColumns: [
        professionalReviewRevisions.caseId,
        professionalReviewRevisions.professionalReviewId,
        professionalReviewRevisions.id,
      ],
      name: "professional_review_evidence_revision_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.documentId, table.documentVersionId],
      foreignColumns: [
        documentVersions.caseId,
        documentVersions.documentId,
        documentVersions.id,
      ],
      name: "professional_review_evidence_document_version_fk",
    }).onDelete("restrict"),
    check(
      "professional_review_evidence_purpose_check",
      sql`length(trim(${table.purpose})) between 1 and 1000`,
    ),
  ],
);

export const professionalReviewAcknowledgements = resurgoSchema.table(
  "professional_review_acknowledgements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    professionalReviewId: uuid("professional_review_id").notNull(),
    reviewRevisionId: uuid("review_revision_id").notNull(),
    attorneyCaseMembershipId: uuid("attorney_case_membership_id").notNull(),
    action: reviewAcknowledgementAction("action").notNull(),
    note: text("note"),
    statementHash: char("statement_hash", { length: 64 }).notNull(),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("professional_review_acknowledgements_revision_time_idx").on(
      table.reviewRevisionId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [
        table.caseId,
        table.professionalReviewId,
        table.reviewRevisionId,
      ],
      foreignColumns: [
        professionalReviewRevisions.caseId,
        professionalReviewRevisions.professionalReviewId,
        professionalReviewRevisions.id,
      ],
      name: "professional_review_acknowledgements_revision_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.attorneyCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "professional_review_acknowledgements_attorney_fk",
    }).onDelete("restrict"),
    check(
      "professional_review_acknowledgements_hash_check",
      sql`${table.statementHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "professional_review_acknowledgements_note_check",
      sql`${table.note} is null or length(trim(${table.note})) between 3 and 4000`,
    ),
  ],
);

export const settlementFeasibilityRevisions = resurgoSchema.table(
  "settlement_feasibility_revisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    professionalReviewId: uuid("professional_review_id").notNull(),
    reviewRevisionId: uuid("review_revision_id").notNull(),
    propertyDisposition: text("property_disposition").notNull(),
    existingMortgageResponsibility: text(
      "existing_mortgage_responsibility",
    ).notNull(),
    proposedPathway: text("proposed_pathway").notNull(),
    equityBuyoutAmount: numeric("equity_buyout_amount", {
      precision: 14,
      scale: 2,
    }),
    proposedSettlementDeadline: timestamp("proposed_settlement_deadline", {
      mode: "date",
      withTimezone: true,
    }),
    financingAssumptions: text("financing_assumptions").notNull(),
    lenderFindings: text("lender_findings"),
    outstandingConditions: text("outstanding_conditions"),
    reviewStage: text("review_stage").default("feasibility_review").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("settlement_feasibility_revision_unique").on(table.reviewRevisionId),
    foreignKey({
      columns: [
        table.caseId,
        table.professionalReviewId,
        table.reviewRevisionId,
      ],
      foreignColumns: [
        professionalReviewRevisions.caseId,
        professionalReviewRevisions.professionalReviewId,
        professionalReviewRevisions.id,
      ],
      name: "settlement_feasibility_review_revision_fk",
    }).onDelete("restrict"),
    check(
      "settlement_feasibility_disposition_check",
      sql`${table.propertyDisposition} in ('retain_by_client', 'retain_by_spouse', 'sell', 'undecided', 'other')`,
    ),
    check(
      "settlement_feasibility_pathway_check",
      sql`${table.proposedPathway} in ('refinance', 'assumption', 'sale', 'payoff', 'other', 'undecided')`,
    ),
    check(
      "settlement_feasibility_stage_check",
      sql`${table.reviewStage} in ('feasibility_review', 'preapproval', 'underwriting', 'closing')`,
    ),
    check(
      "settlement_feasibility_buyout_check",
      sql`${table.equityBuyoutAmount} is null or ${table.equityBuyoutAmount} >= 0`,
    ),
  ],
);
