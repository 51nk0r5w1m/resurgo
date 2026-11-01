import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { caseMemberships, cases } from "./collaboration";
import { discoveryOutputs } from "./discovery";
import { caseTaskStatus, resourceClassification } from "./enums";
import { caseResources } from "./resources";
import { resurgoSchema } from "./system";

export const caseTasks = resurgoSchema.table(
  "case_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    caseResourceId: uuid("case_resource_id").notNull(),
    sourceDiscoveryOutputId: uuid("source_discovery_output_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    responsibleRole: text("responsible_role").notNull(),
    classification: resourceClassification("classification").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("case_tasks_case_id_id_unique").on(table.caseId, table.id),
    unique("case_tasks_case_resource_unique").on(
      table.caseId,
      table.caseResourceId,
    ),
    unique("case_tasks_source_output_unique").on(table.sourceDiscoveryOutputId),
    foreignKey({
      columns: [table.caseId, table.caseResourceId],
      foreignColumns: [caseResources.caseId, caseResources.id],
      name: "case_tasks_resource_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.sourceDiscoveryOutputId, table.caseId],
      foreignColumns: [discoveryOutputs.id, discoveryOutputs.caseId],
      name: "case_tasks_discovery_output_fk",
    }).onDelete("restrict"),
    check(
      "case_tasks_title_check",
      sql`length(trim(${table.title})) between 1 and 240`,
    ),
    check(
      "case_tasks_description_check",
      sql`length(trim(${table.description})) between 1 and 4000`,
    ),
    check(
      "case_tasks_role_check",
      sql`${table.responsibleRole} in ('client', 'attorney', 'lender', 'accountant', 'coordinator')`,
    ),
  ],
);

export const caseTaskEvents = resurgoSchema.table(
  "case_task_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    caseTaskId: uuid("case_task_id").notNull(),
    actorCaseMembershipId: uuid("actor_case_membership_id").notNull(),
    status: caseTaskStatus("status").notNull(),
    occurredAt: timestamp("occurred_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("case_task_events_task_time_idx").on(
      table.caseTaskId,
      table.occurredAt,
    ),
    foreignKey({
      columns: [table.caseId, table.caseTaskId],
      foreignColumns: [caseTasks.caseId, caseTasks.id],
      name: "case_task_events_task_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.actorCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "case_task_events_actor_fk",
    }).onDelete("restrict"),
  ],
);

export const reviewPrerequisites = resurgoSchema.table(
  "review_prerequisites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    sourceDiscoveryOutputId: uuid("source_discovery_output_id").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    responsibleRole: text("responsible_role").notNull(),
    status: text("status").default("outstanding").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("review_prerequisites_output_unique").on(
      table.sourceDiscoveryOutputId,
    ),
    index("review_prerequisites_case_status_idx").on(
      table.caseId,
      table.status,
    ),
    foreignKey({
      columns: [table.sourceDiscoveryOutputId, table.caseId],
      foreignColumns: [discoveryOutputs.id, discoveryOutputs.caseId],
      name: "review_prerequisites_discovery_output_fk",
    }).onDelete("restrict"),
    check(
      "review_prerequisites_status_check",
      sql`${table.status} in ('outstanding', 'satisfied', 'waived')`,
    ),
  ],
);
