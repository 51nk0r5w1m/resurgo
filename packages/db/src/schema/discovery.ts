import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { cases } from "./collaboration";
import { discoveryStatus, recommendationService, roadmapStatus } from "./enums";
import { resurgoSchema } from "./system";

export const discoverySessions = resurgoSchema.table(
  "discovery_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    status: discoveryStatus("status").default("in_progress").notNull(),
    definitionVersion: text("definition_version")
      .default("atlanta-pilot-2026.1")
      .notNull(),
    revision: integer("revision").default(0).notNull(),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("discovery_sessions_case_unique").on(table.caseId),
    unique("discovery_sessions_id_case_unique").on(table.id, table.caseId),
    check(
      "discovery_sessions_completion_check",
      sql`(${table.status} = 'completed' and ${table.completedAt} is not null) or (${table.status} = 'in_progress' and ${table.completedAt} is null)`,
    ),
  ],
);

export const discoveryAnswers = resurgoSchema.table(
  "discovery_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "restrict" }),
    questionKey: text("question_key").notNull(),
    answer: jsonb("answer").notNull(),
    definitionVersion: text("definition_version")
      .default("atlanta-pilot-2026.1")
      .notNull(),
    answerStatus: text("answer_status").default("answered").notNull(),
    source: text("source").default("client_reported").notNull(),
    verificationStatus: text("verification_status")
      .default("unverified")
      .notNull(),
    classification: text("classification").default("shared").notNull(),
    documentVersionId: uuid("document_version_id"),
    revision: integer("revision").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("discovery_answers_session_question_revision_unique").on(
      table.discoverySessionId,
      table.questionKey,
      table.revision,
    ),
    index("discovery_answers_session_revision_idx").on(
      table.discoverySessionId,
      table.revision,
    ),
    check(
      "discovery_answers_question_key_check",
      sql`length(${table.questionKey}) between 1 and 120 and ${table.questionKey} ~ '^[a-z][a-z0-9_]*$'`,
    ),
    check(
      "discovery_answers_status_check",
      sql`${table.answerStatus} in ('answered', 'unknown', 'not_applicable', 'deferred')`,
    ),
    check(
      "discovery_answers_source_check",
      sql`${table.source} in ('client_reported', 'document_reported', 'professional_reported')`,
    ),
    check(
      "discovery_answers_verification_check",
      sql`${table.verificationStatus} in ('unverified', 'client_confirmed', 'document_verified', 'professional_reviewed')`,
    ),
    check(
      "discovery_answers_classification_check",
      sql`${table.classification} in ('shared', 'legal', 'financial', 'health')`,
    ),
  ],
);

export const discoveryOutputs = resurgoSchema.table(
  "discovery_outputs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "restrict" }),
    generation: integer("generation").notNull(),
    type: text("type").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    classification: text("classification").notNull(),
    ruleId: text("rule_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("discovery_outputs_session_generation_code_unique").on(
      table.discoverySessionId,
      table.generation,
      table.code,
    ),
    index("discovery_outputs_case_generation_idx").on(
      table.caseId,
      table.generation,
    ),
    check(
      "discovery_outputs_type_check",
      sql`${table.type} in ('document_request', 'review_trigger')`,
    ),
    check(
      "discovery_outputs_classification_check",
      sql`${table.classification} in ('shared', 'legal', 'financial', 'health')`,
    ),
    foreignKey({
      columns: [table.discoverySessionId, table.caseId],
      foreignColumns: [discoverySessions.id, discoverySessions.caseId],
      name: "discovery_outputs_session_case_fk",
    }).onDelete("restrict"),
  ],
);

export const recommendations = resurgoSchema.table(
  "recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    discoverySessionId: uuid("discovery_session_id")
      .notNull()
      .references(() => discoverySessions.id, { onDelete: "restrict" }),
    generation: integer("generation").notNull(),
    ruleVersion: text("rule_version").notNull(),
    service: recommendationService("service").notNull(),
    explanation: text("explanation").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("recommendations_session_generation_service_unique").on(
      table.discoverySessionId,
      table.generation,
      table.service,
    ),
    unique("recommendations_id_case_unique").on(table.id, table.caseId),
    foreignKey({
      columns: [table.discoverySessionId, table.caseId],
      foreignColumns: [discoverySessions.id, discoverySessions.caseId],
      name: "recommendations_session_case_fk",
    }).onDelete("restrict"),
    index("recommendations_case_generation_idx").on(
      table.caseId,
      table.generation,
    ),
  ],
);

export const roadmapItems = resurgoSchema.table(
  "roadmap_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    recommendationId: uuid("recommendation_id").references(
      () => recommendations.id,
      { onDelete: "restrict" },
    ),
    generation: integer("generation").notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: roadmapStatus("status").default("upcoming").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("roadmap_items_case_generation_position_unique").on(
      table.caseId,
      table.generation,
      table.position,
    ),
    foreignKey({
      columns: [table.recommendationId, table.caseId],
      foreignColumns: [recommendations.id, recommendations.caseId],
      name: "roadmap_items_recommendation_case_fk",
    }).onDelete("restrict"),
    index("roadmap_items_case_generation_idx").on(
      table.caseId,
      table.generation,
    ),
  ],
);
