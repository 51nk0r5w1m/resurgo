import { sql } from "drizzle-orm";
import {
  bigint,
  char,
  check,
  index,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { cases } from "./collaboration";
import { auditActorType, auditOutcome } from "./enums";
import { resurgoSchema } from "./system";

export const auditEvents = resurgoSchema.table(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sequence: bigint("sequence", { mode: "bigint" })
      .generatedAlwaysAsIdentity()
      .notNull(),
    actorType: auditActorType("actor_type").notNull(),
    actorUserId: uuid("actor_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    caseId: uuid("case_id").references(() => cases.id, {
      onDelete: "restrict",
    }),
    outcome: auditOutcome("outcome").notNull(),
    reasonCode: text("reason_code"),
    correlationId: uuid("correlation_id").notNull(),
    nonce: uuid("nonce"),
    causationId: uuid("causation_id"),
    occurredAt: timestamp("occurred_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    previousEventHash: char("previous_event_hash", { length: 64 }),
    eventHash: char("event_hash", { length: 64 }).notNull(),
  },
  (table) => [
    unique("audit_events_sequence_unique").on(table.sequence),
    unique("audit_events_event_hash_unique").on(table.eventHash),
    index("audit_events_case_occurred_at_idx").on(
      table.caseId,
      table.occurredAt,
    ),
    index("audit_events_actor_occurred_at_idx").on(
      table.actorUserId,
      table.occurredAt,
    ),
    index("audit_events_correlation_id_idx").on(table.correlationId),
    check(
      "audit_events_actor_check",
      sql`(${table.actorType} = 'user' and ${table.actorUserId} is not null) or (${table.actorType} = 'system' and ${table.actorUserId} is null)`,
    ),
    check(
      "audit_events_hash_check",
      sql`${table.eventHash} ~ '^[0-9a-f]{64}$' and (${table.previousEventHash} is null or ${table.previousEventHash} ~ '^[0-9a-f]{64}$')`,
    ),
  ],
);
