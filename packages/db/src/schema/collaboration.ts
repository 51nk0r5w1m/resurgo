import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import {
  caseRole,
  caseStatus,
  membershipStatus,
  organizationRole,
  organizationType,
  pilotVerificationStatus,
} from "./enums";
import { resurgoSchema } from "./system";

export const organizations = resurgoSchema.table(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    type: organizationType("type").notNull(),
    pilotStatus: pilotVerificationStatus("pilot_status")
      .default("candidate")
      .notNull(),
    verifiedAt: timestamp("verified_at", { mode: "date", withTimezone: true }),
    verifiedByUserId: uuid("verified_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("organizations_slug_unique").on(table.slug),
    check(
      "organizations_slug_format_check",
      sql`${table.slug} ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'`,
    ),
    check(
      "organizations_pilot_verification_check",
      sql`(${table.pilotStatus} = 'candidate' and ${table.verifiedAt} is null and ${table.verifiedByUserId} is null) or (${table.pilotStatus} <> 'candidate' and ${table.verifiedAt} is not null and ${table.verifiedByUserId} is not null)`,
    ),
  ],
);

export const jurisdictions = resurgoSchema.table(
  "jurisdictions",
  {
    code: text("code").primaryKey(),
    stateCode: text("state_code").notNull(),
    countyName: text("county_name").notNull(),
    courtName: text("court_name").notNull(),
    judicialCircuit: text("judicial_circuit").notNull(),
    sourceUrl: text("source_url").notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    reviewedAt: timestamp("reviewed_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [
    check(
      "jurisdictions_code_format_check",
      sql`${table.code} ~ '^[A-Z]{2}-[A-Z]+-SUPERIOR$'`,
    ),
  ],
);

export const organizationMemberships = resurgoSchema.table(
  "organization_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    role: organizationRole("role").notNull(),
    status: membershipStatus("status").default("invited").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    validFrom: timestamp("valid_from", {
      mode: "date",
      withTimezone: true,
    }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("organization_memberships_organization_user_unique").on(
      table.organizationId,
      table.userId,
    ),
    unique("organization_memberships_id_user_unique").on(
      table.id,
      table.userId,
    ),
    index("organization_memberships_user_idx").on(table.userId),
    index("organization_memberships_organization_status_idx").on(
      table.organizationId,
      table.status,
    ),
    check(
      "organization_memberships_valid_interval_check",
      sql`${table.expiresAt} is null or ${table.validFrom} is null or ${table.expiresAt} > ${table.validFrom}`,
    ),
    check(
      "organization_memberships_lifecycle_check",
      sql`(${table.status} not in ('active', 'suspended') or ${table.validFrom} is not null) and (${table.status} <> 'expired' or ${table.expiresAt} is not null)`,
    ),
    check(
      "organization_memberships_revoked_state_check",
      sql`(${table.status} = 'revoked' and ${table.revokedAt} is not null) or (${table.status} <> 'revoked' and ${table.revokedAt} is null)`,
    ),
  ],
);

export const cases = resurgoSchema.table(
  "cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    jurisdictionCode: text("jurisdiction_code")
      .notNull()
      .references(() => jurisdictions.code, { onDelete: "restrict" }),
    status: caseStatus("status").default("active").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("cases_id_owner_unique").on(table.id, table.ownerUserId),
    index("cases_owner_user_idx").on(table.ownerUserId),
  ],
);

export const caseMemberships = resurgoSchema.table(
  "case_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    organizationMembershipId: uuid("organization_membership_id"),
    role: caseRole("role").notNull(),
    status: membershipStatus("status").default("invited").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => user.id, {
      onDelete: "restrict",
    }),
    validFrom: timestamp("valid_from", {
      mode: "date",
      withTimezone: true,
    }),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),
    revokedAt: timestamp("revoked_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("case_memberships_case_user_unique").on(table.caseId, table.userId),
    unique("case_memberships_case_id_id_unique").on(table.caseId, table.id),
    uniqueIndex("case_memberships_one_owner_idx")
      .on(table.caseId)
      .where(sql`${table.role} = 'owner'`),
    index("case_memberships_user_status_idx").on(table.userId, table.status),
    index("case_memberships_case_status_idx").on(table.caseId, table.status),
    foreignKey({
      columns: [table.organizationMembershipId, table.userId],
      foreignColumns: [
        organizationMemberships.id,
        organizationMemberships.userId,
      ],
      name: "case_memberships_organization_membership_user_fk",
    }).onDelete("restrict"),
    check(
      "case_memberships_professional_affiliation_check",
      sql`(${table.role} in ('attorney', 'lender', 'accountant', 'mediator', 'support_professional') and ${table.organizationMembershipId} is not null) or (${table.role} not in ('attorney', 'lender', 'accountant', 'mediator', 'support_professional') and ${table.organizationMembershipId} is null)`,
    ),
    check(
      "case_memberships_valid_interval_check",
      sql`${table.expiresAt} is null or ${table.validFrom} is null or ${table.expiresAt} > ${table.validFrom}`,
    ),
    check(
      "case_memberships_lifecycle_check",
      sql`(${table.status} not in ('active', 'suspended') or ${table.validFrom} is not null) and (${table.status} <> 'expired' or ${table.expiresAt} is not null)`,
    ),
    check(
      "case_memberships_revoked_state_check",
      sql`(${table.status} = 'revoked' and ${table.revokedAt} is not null) or (${table.status} <> 'revoked' and ${table.revokedAt} is null)`,
    ),
  ],
);
