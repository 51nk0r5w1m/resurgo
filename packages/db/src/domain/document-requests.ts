import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseMemberships,
  caseResources,
  disclosureConsents,
  documentRequestEvents,
  documentRequests,
  documents,
  documentVersions,
  resourceGrants,
} from "../schema";
import {
  AuthorizationDeniedError,
  hasEffectiveResourceAccess,
  requireCaseAuthorization,
} from "./authorization";
import { buildAuditEvent } from "./audit";

type Database = NodePgDatabase<typeof schema>;
type Classification =
  "shared" | "legal" | "financial" | "personal_support" | "health";
type RequestStatus = "requested" | "submitted" | "completed" | "cancelled";

const transitions: Record<RequestStatus, readonly RequestStatus[]> = {
  requested: ["submitted", "cancelled"],
  submitted: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

async function requireActiveConsent(
  database: Database,
  input: {
    caseId: string;
    classification: Classification;
    consentId: string;
    membershipId: string;
    operation: "contribute" | "view";
  },
) {
  const [consent] = await database
    .select({ id: disclosureConsents.id })
    .from(disclosureConsents)
    .where(
      and(
        eq(disclosureConsents.caseId, input.caseId),
        eq(disclosureConsents.id, input.consentId),
        eq(disclosureConsents.recipientCaseMembershipId, input.membershipId),
        eq(disclosureConsents.classification, input.classification),
        eq(disclosureConsents.operation, input.operation),
        eq(disclosureConsents.status, "active"),
        sql`${disclosureConsents.effectiveAt} <= now()`,
        sql`(${disclosureConsents.expiresAt} is null or ${disclosureConsents.expiresAt} > now())`,
        sql`${disclosureConsents.revokedAt} is null`,
      ),
    )
    .limit(1);
  if (!consent) throw new AuthorizationDeniedError();
}

export async function createDocumentRequest(
  database: Database,
  input: {
    assignedToCaseMembershipId?: string;
    assigneeConsentIds?: { contribute: string; view: string };
    caseId: string;
    classification: Classification;
    description: string;
    dueAt?: Date;
    title: string;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const owner = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    if (input.assignedToCaseMembershipId) {
      if (!input.assigneeConsentIds) throw new AuthorizationDeniedError();
      const [assignee] = await transaction
        .select({ userId: caseMemberships.userId })
        .from(caseMemberships)
        .where(
          and(
            eq(caseMemberships.caseId, input.caseId),
            eq(caseMemberships.id, input.assignedToCaseMembershipId),
          ),
        )
        .limit(1);
      if (!assignee) throw new AuthorizationDeniedError();
      await requireCaseAuthorization(transaction, {
        caseId: input.caseId,
        operation: "read",
        userId: assignee.userId,
      });
      await requireActiveConsent(transaction, {
        caseId: input.caseId,
        classification: input.classification,
        consentId: input.assigneeConsentIds.view,
        membershipId: input.assignedToCaseMembershipId,
        operation: "view",
      });
      await requireActiveConsent(transaction, {
        caseId: input.caseId,
        classification: input.classification,
        consentId: input.assigneeConsentIds.contribute,
        membershipId: input.assignedToCaseMembershipId,
        operation: "contribute",
      });
    } else if (input.assigneeConsentIds) {
      throw new AuthorizationDeniedError();
    }

    const [resource] = await transaction
      .insert(caseResources)
      .values({
        caseId: input.caseId,
        classification: input.classification,
        ownerCaseMembershipId: owner.caseMembershipId,
        type: "document_request",
      })
      .returning();
    if (!resource) throw new Error("Document request resource creation failed");
    const [request] = await transaction
      .insert(documentRequests)
      .values({
        assignedToCaseMembershipId: input.assignedToCaseMembershipId,
        caseId: input.caseId,
        caseResourceId: resource.id,
        classification: input.classification,
        description: input.description,
        dueAt: input.dueAt,
        requestedByCaseMembershipId: owner.caseMembershipId,
        title: input.title,
      })
      .returning();
    if (!request) throw new Error("Document request creation failed");
    await transaction.insert(documentRequestEvents).values({
      actorCaseMembershipId: owner.caseMembershipId,
      caseId: input.caseId,
      documentRequestId: request.id,
      status: "requested",
    });
    await transaction.insert(resourceGrants).values([
      ...(["view", "download", "share", "contribute"] as const).map(
        (operation) => ({
          basis: "case_owner" as const,
          caseId: input.caseId,
          classification: input.classification,
          granteeCaseMembershipId: owner.caseMembershipId,
          operation,
          resourceId: resource.id,
        }),
      ),
      ...(input.assignedToCaseMembershipId && input.assigneeConsentIds
        ? (["view", "contribute"] as const).map((operation) => ({
            basis: "explicit_consent" as const,
            caseId: input.caseId,
            classification: input.classification,
            granteeCaseMembershipId: input.assignedToCaseMembershipId!,
            operation,
            resourceId: resource.id,
            sourceConsentId: input.assigneeConsentIds![operation],
          }))
        : []),
    ]);
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "document_request.created",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: request.id,
        resourceType: "document_request",
      }),
    );
    return request;
  });
}

export async function transitionDocumentRequest(
  database: Database,
  input: {
    caseId: string;
    documentId?: string;
    documentRequestId: string;
    documentVersionId?: string;
    status: Exclude<RequestStatus, "requested">;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const [request] = await transaction
      .select()
      .from(documentRequests)
      .where(
        and(
          eq(documentRequests.caseId, input.caseId),
          eq(documentRequests.id, input.documentRequestId),
        ),
      )
      .limit(1);
    if (
      !request ||
      !(await hasEffectiveResourceAccess(transaction, {
        caseId: input.caseId,
        operation: "contribute",
        resourceId: request.caseResourceId,
        userId: input.userId,
      }))
    ) {
      throw new AuthorizationDeniedError();
    }
    const actor = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "read",
      userId: input.userId,
    });
    await transaction.execute(sql`
      select id from resurgo.document_requests
      where case_id = ${input.caseId}
        and id = ${input.documentRequestId}
      for update
    `);
    const latestResult = await transaction.execute<{
      status: RequestStatus;
    }>(sql`
      select status from resurgo.document_request_events
      where case_id = ${input.caseId}
        and document_request_id = ${input.documentRequestId}
      order by occurred_at desc, id desc
      limit 1
      for update
    `);
    const latest = latestResult.rows[0];
    if (!latest || !transitions[latest.status].includes(input.status)) {
      throw new Error("Invalid document request transition");
    }
    if (
      (input.status === "completed" || input.status === "cancelled") &&
      actor.role !== "owner"
    ) {
      throw new AuthorizationDeniedError();
    }
    if (input.status === "submitted" || input.status === "completed") {
      if (!input.documentId || !input.documentVersionId) {
        throw new Error("Submitted requests require an exact document version");
      }
      const [version] = await transaction
        .select({ resourceId: documents.caseResourceId })
        .from(documentVersions)
        .innerJoin(
          documents,
          and(
            eq(documents.caseId, documentVersions.caseId),
            eq(documents.id, documentVersions.documentId),
          ),
        )
        .innerJoin(
          caseResources,
          and(
            eq(caseResources.caseId, documents.caseId),
            eq(caseResources.id, documents.caseResourceId),
          ),
        )
        .where(
          and(
            eq(documentVersions.caseId, input.caseId),
            eq(documentVersions.documentId, input.documentId),
            eq(documentVersions.id, input.documentVersionId),
            eq(caseResources.classification, request.classification),
            sql`(
              select status from resurgo.document_processing_events event
              where event.case_id = ${input.caseId}
                and event.document_id = ${input.documentId}
                and event.document_version_id = ${input.documentVersionId}
              order by occurred_at desc, id desc limit 1
            ) = 'available'`,
          ),
        )
        .limit(1);
      if (
        !version ||
        !(await hasEffectiveResourceAccess(transaction, {
          caseId: input.caseId,
          operation: "view",
          resourceId: version.resourceId,
          userId: input.userId,
        }))
      ) {
        throw new AuthorizationDeniedError();
      }
    } else if (input.documentId || input.documentVersionId) {
      throw new Error("Cancelled requests cannot reference a document");
    }
    const [event] = await transaction
      .insert(documentRequestEvents)
      .values({
        actorCaseMembershipId: actor.caseMembershipId,
        caseId: input.caseId,
        documentId: input.documentId,
        documentRequestId: input.documentRequestId,
        documentVersionId: input.documentVersionId,
        status: input.status,
      })
      .returning();
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: `document_request.${input.status}`,
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: input.documentRequestId,
        resourceType: "document_request",
      }),
    );
    return event;
  });
}

export async function listAuthorizedDocumentRequests(
  database: Database,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "read" });
  const result = await database.execute<{
    case_resource_id: string;
    classification: Classification;
    description: string;
    document_id: string | null;
    document_request_id: string;
    document_version_id: string | null;
    due_at: Date | null;
    status: RequestStatus;
    title: string;
  }>(sql`
    select request.id as document_request_id, request.case_resource_id,
      request.classification, request.title, request.description, request.due_at,
      latest.status, latest.document_id, latest.document_version_id
    from resurgo.document_requests request
    inner join lateral (
      select status, document_id, document_version_id
      from resurgo.document_request_events event
      where event.case_id = request.case_id
        and event.document_request_id = request.id
      order by occurred_at desc, id desc limit 1
    ) latest on true
    where request.case_id = ${input.caseId}
    order by request.created_at desc
  `);
  const authorized = [];
  for (const row of result.rows) {
    if (
      await hasEffectiveResourceAccess(database, {
        caseId: input.caseId,
        operation: "view",
        resourceId: row.case_resource_id,
        userId: input.userId,
      })
    ) {
      authorized.push(row);
    }
  }
  return authorized;
}
