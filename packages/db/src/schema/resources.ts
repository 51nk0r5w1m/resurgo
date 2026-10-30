import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { caseMemberships, cases } from "./collaboration";
import {
  consentStatus,
  grantBasis,
  grantStatus,
  resourceClassification,
  resourceOperation,
  resourceType,
} from "./enums";
import { resurgoSchema } from "./system";

export const caseResources = resurgoSchema.table(
  "case_resources",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    ownerCaseMembershipId: uuid("owner_case_membership_id").notNull(),
    type: resourceType("type").notNull(),
    classification: resourceClassification("classification").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("case_resources_case_id_id_unique").on(table.caseId, table.id),
    unique("case_resources_case_id_id_classification_unique").on(
      table.caseId,
      table.id,
      table.classification,
    ),
    index("case_resources_case_classification_idx").on(
      table.caseId,
      table.classification,
    ),
    foreignKey({
      columns: [table.caseId, table.ownerCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "case_resources_owner_membership_fk",
    }).onDelete("restrict"),
  ],
);

export const disclosureConsents = resurgoSchema.table(
  "disclosure_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    grantorCaseMembershipId: uuid("grantor_case_membership_id").notNull(),
    recipientCaseMembershipId: uuid("recipient_case_membership_id").notNull(),
    classification: resourceClassification("classification").notNull(),
    operation: resourceOperation("operation").notNull(),
    purpose: text("purpose").notNull(),
    termsHash: char("terms_hash", { length: 64 }).notNull(),
    status: consentStatus("status").default("active").notNull(),
    effectiveAt: timestamp("effective_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("disclosure_consents_grant_scope_unique").on(
      table.caseId,
      table.id,
      table.recipientCaseMembershipId,
      table.classification,
      table.operation,
    ),
    index("disclosure_consents_case_recipient_status_idx").on(
      table.caseId,
      table.recipientCaseMembershipId,
      table.status,
    ),
    foreignKey({
      columns: [table.caseId, table.grantorCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "disclosure_consents_grantor_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.recipientCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "disclosure_consents_recipient_membership_fk",
    }).onDelete("restrict"),
    check(
      "disclosure_consents_distinct_parties_check",
      sql`${table.grantorCaseMembershipId} <> ${table.recipientCaseMembershipId}`,
    ),
    check(
      "disclosure_consents_terms_hash_check",
      sql`${table.termsHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "disclosure_consents_valid_interval_check",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.effectiveAt}`,
    ),
    check(
      "disclosure_consents_revoked_state_check",
      sql`(${table.status} = 'revoked' and ${table.revokedAt} is not null) or (${table.status} <> 'revoked' and ${table.revokedAt} is null)`,
    ),
    check(
      "disclosure_consents_expired_state_check",
      sql`${table.status} <> 'expired' or ${table.expiresAt} is not null`,
    ),
  ],
);

export const resourceGrants = resurgoSchema.table(
  "resource_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id").notNull(),
    resourceId: uuid("resource_id").notNull(),
    granteeCaseMembershipId: uuid("grantee_case_membership_id").notNull(),
    classification: resourceClassification("classification").notNull(),
    operation: resourceOperation("operation").notNull(),
    basis: grantBasis("basis").notNull(),
    sourceConsentId: uuid("source_consent_id"),
    status: grantStatus("status").default("active").notNull(),
    effectiveAt: timestamp("effective_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("resource_grants_active_scope_unique")
      .on(
        table.resourceId,
        table.granteeCaseMembershipId,
        table.operation,
        table.basis,
      )
      .where(sql`${table.status} = 'active'`),
    index("resource_grants_grantee_status_idx").on(
      table.granteeCaseMembershipId,
      table.status,
    ),
    foreignKey({
      columns: [table.caseId, table.granteeCaseMembershipId],
      foreignColumns: [caseMemberships.caseId, caseMemberships.id],
      name: "resource_grants_grantee_membership_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.caseId, table.resourceId, table.classification],
      foreignColumns: [
        caseResources.caseId,
        caseResources.id,
        caseResources.classification,
      ],
      name: "resource_grants_resource_classification_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [
        table.caseId,
        table.sourceConsentId,
        table.granteeCaseMembershipId,
        table.classification,
        table.operation,
      ],
      foreignColumns: [
        disclosureConsents.caseId,
        disclosureConsents.id,
        disclosureConsents.recipientCaseMembershipId,
        disclosureConsents.classification,
        disclosureConsents.operation,
      ],
      name: "resource_grants_source_consent_scope_fk",
    }).onDelete("restrict"),
    check(
      "resource_grants_basis_consent_check",
      sql`(${table.basis} = 'explicit_consent' and ${table.sourceConsentId} is not null) or (${table.basis} = 'case_owner' and ${table.sourceConsentId} is null)`,
    ),
    check(
      "resource_grants_valid_interval_check",
      sql`${table.expiresAt} is null or ${table.expiresAt} > ${table.effectiveAt}`,
    ),
    check(
      "resource_grants_revoked_state_check",
      sql`(${table.status} = 'revoked' and ${table.revokedAt} is not null) or (${table.status} <> 'revoked' and ${table.revokedAt} is null)`,
    ),
    check(
      "resource_grants_expired_state_check",
      sql`${table.status} <> 'expired' or ${table.expiresAt} is not null`,
    ),
  ],
);
