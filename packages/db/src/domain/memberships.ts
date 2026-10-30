import { createHash, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import { auditEvents, caseMemberships } from "../schema";
import {
  AuthorizationDeniedError,
  requireCaseAuthorization,
} from "./authorization";

type CaseRole = (typeof schema.caseRole.enumValues)[number];

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
    const [membership] = await transaction
      .insert(caseMemberships)
      .values({
        caseId: input.caseId,
        invitedByUserId: input.actorUserId,
        organizationMembershipId: input.organizationMembershipId,
        role: input.role,
        status: "active",
        userId: input.userId,
        validFrom: new Date(),
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
