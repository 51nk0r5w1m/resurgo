import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import { caseTaskEvents, caseTasks, reviewPrerequisites } from "../schema";
import {
  hasEffectiveResourceAccess,
  requireCaseAuthorization,
} from "./authorization";

type Database = NodePgDatabase<typeof schema>;

export async function listAuthorizedCaseTasks(
  database: Database,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "read" });
  const rows = await database.execute<{
    classification: (typeof schema.resourceClassification.enumValues)[number];
    description: string;
    id: string;
    responsible_role: string;
    resource_id: string;
    status: (typeof schema.caseTaskStatus.enumValues)[number];
    title: string;
  }>(sql`
    select task.id, task.case_resource_id as resource_id, task.classification,
      task.title, task.description, task.responsible_role,
      latest.status
    from resurgo.case_tasks task
    inner join lateral (
      select status from resurgo.case_task_events event
      where event.case_id = task.case_id and event.case_task_id = task.id
      order by event.occurred_at desc, event.id desc limit 1
    ) latest on true
    where task.case_id = ${input.caseId}
    order by task.created_at, task.id
  `);
  const authorized = [];
  for (const row of rows.rows) {
    if (
      await hasEffectiveResourceAccess(database, {
        caseId: input.caseId,
        operation: "view",
        resourceId: row.resource_id,
        userId: input.userId,
      })
    )
      authorized.push(row);
  }
  return authorized;
}

export async function listReviewPrerequisites(
  database: Database,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "manage" });
  return database
    .select()
    .from(reviewPrerequisites)
    .where(eq(reviewPrerequisites.caseId, input.caseId));
}

export async function markDiscoveryOutputWorkflowComplete(
  database: Database,
  input: { caseId: string; sourceDiscoveryOutputId: string; userId: string },
) {
  return database.transaction(async (transaction) => {
    const actor = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "read",
      userId: input.userId,
    });
    const tasks = await transaction
      .select({ id: caseTasks.id })
      .from(caseTasks)
      .where(
        and(
          eq(caseTasks.caseId, input.caseId),
          eq(caseTasks.sourceDiscoveryOutputId, input.sourceDiscoveryOutputId),
        ),
      );
    for (const task of tasks) {
      await transaction.insert(caseTaskEvents).values({
        actorCaseMembershipId: actor.caseMembershipId,
        caseId: input.caseId,
        caseTaskId: task.id,
        status: "completed",
      });
    }
    await transaction
      .update(schema.roadmapItems)
      .set({ status: "completed" })
      .where(
        and(
          eq(schema.roadmapItems.caseId, input.caseId),
          eq(
            schema.roadmapItems.sourceDiscoveryOutputId,
            input.sourceDiscoveryOutputId,
          ),
        ),
      );
    await transaction
      .update(reviewPrerequisites)
      .set({ status: "satisfied" })
      .where(
        and(
          eq(reviewPrerequisites.caseId, input.caseId),
          eq(
            reviewPrerequisites.sourceDiscoveryOutputId,
            input.sourceDiscoveryOutputId,
          ),
        ),
      );
  });
}
