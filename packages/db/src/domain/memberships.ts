import { createHash, randomUUID } from "node:crypto";

import { and, eq, isNull, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseMemberships,
  cases,
  organizationMemberships,
  organizations,
  user,
} from "../schema";
import {
  AuthorizationDeniedError,
  requireCaseAuthorization,
} from "./authorization";

type CaseRole = (typeof schema.caseRole.enumValues)[number];

function professionalRoleFor(
  organizationType: (typeof schema.organizationType.enumValues)[number],
): Exclude<CaseRole, "owner" | "co_client" | "coordinator"> {
  if (organizationType === "law_firm") return "attorney";
  if (organizationType === "lender") return "lender";
  if (organizationType === "accounting_firm") return "accountant";
  if (organizationType === "mediation_practice") return "mediator";
  return "support_professional";
}

function eventHash(value: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify({ ...value, nonce: randomUUID() }))
    .digest("hex");
}

export async function grantCaseMembership(
  database: NodePgDatabase<typeof schema>,
  input: {
    actorUserId: string;
    caseId: string;
    correlationId?: string;
    organizationMembershipId?: string;
    role: Exclude<CaseRole, "owner">;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "membership_grant",
      userId: input.actorUserId,
    });
    if (input.organizationMembershipId) {
      const [verified] = await transaction
        .select({ type: organizations.type })
        .from(organizationMemberships)
        .innerJoin(
          organizations,
          eq(organizations.id, organizationMemberships.organizationId),
        )
        .where(
          and(
            eq(organizationMemberships.id, input.organizationMembershipId),
            eq(organizationMemberships.userId, input.userId),
            eq(organizationMemberships.status, "active"),
            eq(organizations.pilotStatus, "verified"),
          ),
        )
        .limit(1);
      if (!verified || professionalRoleFor(verified.type) !== input.role) {
        throw new AuthorizationDeniedError();
      }
    } else if (
      [
        "attorney",
        "lender",
        "accountant",
        "mediator",
        "support_professional",
      ].includes(input.role)
    ) {
      throw new AuthorizationDeniedError();
    }
    const [membership] = await transaction
      .insert(caseMemberships)
      .values({
        caseId: input.caseId,
        invitedByUserId: input.actorUserId,
        organizationMembershipId: input.organizationMembershipId,
        role: input.role,
        status: "invited",
        userId: input.userId,
      })
      .returning();
    if (!membership) throw new AuthorizationDeniedError();

    const correlationId = input.correlationId ?? randomUUID();
    await transaction.insert(auditEvents).values({
      actorType: "user",
      actorUserId: input.actorUserId,
      action: "case.membership.granted",
      resourceType: "case_membership",
      resourceId: membership.id,
      caseId: input.caseId,
      outcome: "success",
      correlationId,
      eventHash: eventHash({
        action: "case.membership.granted",
        actorUserId: input.actorUserId,
        caseId: input.caseId,
        correlationId,
        membershipId: membership.id,
      }),
    });
    return membership;
  });
}

export async function acceptCaseMembership(
  database: NodePgDatabase<typeof schema>,
  input: { caseId: string; membershipId: string; userId: string },
) {
  return database.transaction(async (transaction) => {
    const acceptedAt = new Date();
    const [membership] = await transaction
      .update(caseMemberships)
      .set({ status: "active", updatedAt: acceptedAt, validFrom: acceptedAt })
      .where(
        and(
          eq(caseMemberships.caseId, input.caseId),
          eq(caseMemberships.id, input.membershipId),
          eq(caseMemberships.userId, input.userId),
          eq(caseMemberships.status, "invited"),
        ),
      )
      .returning();
    if (!membership) throw new AuthorizationDeniedError();
    await transaction.insert(auditEvents).values({
      actorType: "user",
      actorUserId: input.userId,
      action: "case.membership.accepted",
      resourceType: "case_membership",
      resourceId: membership.id,
      caseId: input.caseId,
      outcome: "success",
      correlationId: randomUUID(),
      eventHash: eventHash({
        action: "case.membership.accepted",
        caseId: input.caseId,
        membershipId: membership.id,
        userId: input.userId,
      }),
    });
    return membership;
  });
}

export async function listPendingCaseInvitations(
  database: NodePgDatabase<typeof schema>,
  userId: string,
) {
  return database
    .select({
      caseId: caseMemberships.caseId,
      jurisdictionCode: cases.jurisdictionCode,
      membershipId: caseMemberships.id,
      organizationName: organizations.name,
      role: caseMemberships.role,
    })
    .from(caseMemberships)
    .innerJoin(cases, eq(cases.id, caseMemberships.caseId))
    .leftJoin(
      organizationMemberships,
      eq(organizationMemberships.id, caseMemberships.organizationMembershipId),
    )
    .leftJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId),
    )
    .where(
      and(
        eq(caseMemberships.userId, userId),
        eq(caseMemberships.status, "invited"),
        eq(cases.status, "active"),
      ),
    );
}

export async function listVerifiedPilotProfessionals(
  database: NodePgDatabase<typeof schema>,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "manage" });
  return database
    .select({
      name: user.name,
      organizationMembershipId: organizationMemberships.id,
      organizationName: organizations.name,
      organizationType: organizations.type,
      role: sql<CaseRole>`case ${organizations.type}
        when 'law_firm' then 'attorney'
        when 'lender' then 'lender'
        when 'accounting_firm' then 'accountant'
        when 'mediation_practice' then 'mediator'
        else 'support_professional'
      end`,
      userId: user.id,
    })
    .from(organizationMemberships)
    .innerJoin(user, eq(user.id, organizationMemberships.userId))
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId),
    )
    .where(
      and(
        eq(organizationMemberships.status, "active"),
        sql`${organizationMemberships.validFrom} <= now()`,
        or(
          isNull(organizationMemberships.expiresAt),
          sql`${organizationMemberships.expiresAt} > now()`,
        ),
        isNull(organizationMemberships.revokedAt),
        eq(organizations.pilotStatus, "verified"),
        eq(user.emailVerified, true),
        eq(user.twoFactorEnabled, true),
        sql`not exists (
          select 1 from resurgo.case_memberships existing
          where existing.case_id = ${input.caseId}
            and existing.user_id = ${user.id}
        )`,
      ),
    );
}

export async function revokeCaseMembership(
  database: NodePgDatabase<typeof schema>,
  input: {
    actorUserId: string;
    caseId: string;
    correlationId?: string;
    membershipId: string;
  },
) {
  return database.transaction(async (transaction) => {
    await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "membership_revoke",
      userId: input.actorUserId,
    });
    const revokedAt = new Date();
    const [membership] = await transaction
      .update(caseMemberships)
      .set({ status: "revoked", revokedAt, updatedAt: revokedAt })
      .where(
        and(
          eq(caseMemberships.caseId, input.caseId),
          eq(caseMemberships.id, input.membershipId),
          eq(caseMemberships.status, "active"),
        ),
      )
      .returning();
    if (!membership || membership.role === "owner") {
      throw new AuthorizationDeniedError();
    }

    const correlationId = input.correlationId ?? randomUUID();
    await transaction.insert(auditEvents).values({
      actorType: "user",
      actorUserId: input.actorUserId,
      action: "case.membership.revoked",
      resourceType: "case_membership",
      resourceId: membership.id,
      caseId: input.caseId,
      outcome: "success",
      correlationId,
      eventHash: eventHash({
        action: "case.membership.revoked",
        actorUserId: input.actorUserId,
        caseId: input.caseId,
        correlationId,
        membershipId: membership.id,
      }),
    });
    return membership;
  });
}
