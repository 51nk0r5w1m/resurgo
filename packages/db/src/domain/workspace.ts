import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseMemberships,
  organizationMemberships,
  organizations,
  user,
} from "../schema";
import { requireCaseAuthorization } from "./authorization";

type Database = NodePgDatabase<typeof schema>;

export async function listAuthorizedCaseMembers(
  database: Database,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "read" });
  return database
    .select({
      id: caseMemberships.id,
      name: user.name,
      organizationName: organizations.name,
      role: caseMemberships.role,
      status: caseMemberships.status,
    })
    .from(caseMemberships)
    .innerJoin(user, eq(user.id, caseMemberships.userId))
    .leftJoin(
      organizationMemberships,
      and(
        eq(
          organizationMemberships.id,
          caseMemberships.organizationMembershipId,
        ),
        eq(organizationMemberships.userId, caseMemberships.userId),
      ),
    )
    .leftJoin(
      organizations,
      eq(organizations.id, organizationMemberships.organizationId),
    )
    .where(eq(caseMemberships.caseId, input.caseId))
    .orderBy(caseMemberships.createdAt, caseMemberships.id);
}

export async function listAuthorizedCaseActivity(
  database: Database,
  input: { caseId: string; limit?: number; userId: string },
) {
  // Full case activity can reveal the existence of restricted resources. Keep
  // it owner-only until resource-filtered professional activity is introduced.
  await requireCaseAuthorization(database, { ...input, operation: "manage" });
  return database
    .select({
      action: auditEvents.action,
      actorName: user.name,
      occurredAt: auditEvents.occurredAt,
      outcome: auditEvents.outcome,
      resourceType: auditEvents.resourceType,
    })
    .from(auditEvents)
    .leftJoin(user, eq(user.id, auditEvents.actorUserId))
    .where(eq(auditEvents.caseId, input.caseId))
    .orderBy(desc(auditEvents.occurredAt), desc(auditEvents.sequence))
    .limit(Math.min(input.limit ?? 25, 100));
}
