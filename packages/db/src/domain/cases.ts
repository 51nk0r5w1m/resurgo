import { createHash, randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseMemberships,
  cases,
  discoverySessions,
} from "../schema";
import {
  decideCaseAuthorization,
  requireCaseAuthorization,
} from "./authorization";

export interface CreateCaseWithOwnerInput {
  correlationId?: string;
  jurisdictionCode: string;
  ownerUserId: string;
}

function auditHash(value: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify({ ...value, nonce: randomUUID() }))
    .digest("hex");
}

export async function createCaseWithOwner(
  database: NodePgDatabase<typeof schema>,
  input: CreateCaseWithOwnerInput,
) {
  return database.transaction(async (transaction) => {
    const [createdCase] = await transaction
      .insert(cases)
      .values({
        createdByUserId: input.ownerUserId,
        jurisdictionCode: input.jurisdictionCode,
        ownerUserId: input.ownerUserId,
      })
      .returning();

    if (!createdCase) {
      throw new Error("Case creation did not return a record");
    }

    const [ownerMembership] = await transaction
      .insert(caseMemberships)
      .values({
        caseId: createdCase.id,
        role: "owner",
        status: "active",
        userId: input.ownerUserId,
        validFrom: createdCase.createdAt,
      })
      .returning();

    if (!ownerMembership) {
      throw new Error("Owner membership creation did not return a record");
    }

    const [discoverySession] = await transaction
      .insert(discoverySessions)
      .values({ caseId: createdCase.id })
      .returning();
    if (!discoverySession) {
      throw new Error("Discovery session creation did not return a record");
    }

    const correlationId = input.correlationId ?? randomUUID();
    await transaction.insert(auditEvents).values({
      actorType: "user",
      actorUserId: input.ownerUserId,
      action: "case.created",
      resourceType: "case",
      resourceId: createdCase.id,
      caseId: createdCase.id,
      outcome: "success",
      correlationId,
      eventHash: auditHash({
        action: "case.created",
        actorUserId: input.ownerUserId,
        caseId: createdCase.id,
        correlationId,
      }),
    });

    return { case: createdCase, discoverySession, ownerMembership };
  });
}

export async function listAccessibleCases(
  database: NodePgDatabase<typeof schema>,
  userId: string,
) {
  const candidates = await database
    .select({
      id: cases.id,
      jurisdictionCode: cases.jurisdictionCode,
      role: caseMemberships.role,
      status: cases.status,
    })
    .from(caseMemberships)
    .innerJoin(cases, eq(cases.id, caseMemberships.caseId))
    .where(
      and(
        eq(caseMemberships.userId, userId),
        eq(caseMemberships.status, "active"),
        eq(cases.status, "active"),
      ),
    );
  const decisions = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      decision: await decideCaseAuthorization(database, {
        caseId: candidate.id,
        operation: "read",
        userId,
      }),
    })),
  );
  return decisions
    .filter(({ decision }) => decision.allowed)
    .map(({ candidate }) => candidate);
}

export async function getAuthorizedCase(
  database: NodePgDatabase<typeof schema>,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "read" });
  const [caseRecord] = await database
    .select({
      id: cases.id,
      jurisdictionCode: cases.jurisdictionCode,
      ownerUserId: cases.ownerUserId,
      status: cases.status,
    })
    .from(cases)
    .where(eq(cases.id, input.caseId))
    .limit(1);
  return caseRecord;
}
