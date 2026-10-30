import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseMemberships,
  caseResources,
  disclosureConsents,
  documents,
  documentVersions,
  professionalReviewAcknowledgements,
  professionalReviewEvidence,
  professionalReviewRevisions,
  professionalReviews,
  professionalReviewStatements,
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
type ReviewStatus =
  | "assigned"
  | "in_progress"
  | "clarification_required"
  | "completed"
  | "withdrawn"
  | "superseded";
type SubjectType =
  | "document_set"
  | "mortgage_property"
  | "financial_position"
  | "legal_strategy"
  | "case_coordination"
  | "other";
type ReviewStatement = {
  body: string;
  conditionStatus?: "open" | "satisfied" | "waived" | "not_applicable";
  type: "finding" | "outstanding_condition" | "clarification_request";
};
type EvidenceReference = {
  documentId: string;
  documentVersionId: string;
  purpose: string;
};

const transitions: Record<ReviewStatus, readonly ReviewStatus[]> = {
  assigned: ["in_progress", "withdrawn", "superseded"],
  in_progress: [
    "clarification_required",
    "completed",
    "withdrawn",
    "superseded",
  ],
  clarification_required: [
    "in_progress",
    "completed",
    "withdrawn",
    "superseded",
  ],
  completed: ["superseded"],
  withdrawn: [],
  superseded: [],
};

async function evidenceRows(
  database: Database,
  caseId: string,
  evidence: EvidenceReference[],
) {
  const rows = [];
  for (const reference of evidence) {
    const [row] = await database
      .select({
        documentId: documents.id,
        documentVersionId: documentVersions.id,
        resourceId: documents.caseResourceId,
      })
      .from(documentVersions)
      .innerJoin(
        documents,
        and(
          eq(documents.id, documentVersions.documentId),
          eq(documents.caseId, documentVersions.caseId),
        ),
      )
      .where(
        and(
          eq(documentVersions.caseId, caseId),
          eq(documentVersions.documentId, reference.documentId),
          eq(documentVersions.id, reference.documentVersionId),
        ),
      )
      .limit(1);
    if (!row) throw new AuthorizationDeniedError();
    rows.push({ ...row, purpose: reference.purpose });
  }
  return rows;
}

async function requireEvidenceAccess(
  database: Database,
  caseId: string,
  userId: string,
  evidence: Awaited<ReturnType<typeof evidenceRows>>,
) {
  for (const reference of evidence) {
    if (
      !(await hasEffectiveResourceAccess(database, {
        caseId,
        operation: "view",
        resourceId: reference.resourceId,
        userId,
      }))
    ) {
      throw new AuthorizationDeniedError();
    }
  }
}

async function insertRevisionDetails(
  database: Database,
  input: {
    caseId: string;
    evidence: Awaited<ReturnType<typeof evidenceRows>>;
    professionalReviewId: string;
    reviewRevisionId: string;
    statements: ReviewStatement[];
  },
) {
  if (input.evidence.length > 0) {
    await database.insert(professionalReviewEvidence).values(
      input.evidence.map((reference) => ({
        caseId: input.caseId,
        documentId: reference.documentId,
        documentVersionId: reference.documentVersionId,
        professionalReviewId: input.professionalReviewId,
        purpose: reference.purpose,
        reviewRevisionId: input.reviewRevisionId,
      })),
    );
  }
  if (input.statements.length > 0) {
    await database.insert(professionalReviewStatements).values(
      input.statements.map((statement) => ({
        body: statement.body,
        caseId: input.caseId,
        conditionStatus: statement.conditionStatus,
        professionalReviewId: input.professionalReviewId,
        reviewRevisionId: input.reviewRevisionId,
        type: statement.type,
      })),
    );
  }
}

export async function createProfessionalReview(
  database: Database,
  input: {
    caseId: string;
    classification: Classification;
    decisionContext: string;
    evidence: EvidenceReference[];
    responsibleCaseMembershipId: string;
    responsibleGrantConsents: {
      contributeConsentId: string;
      viewConsentId: string;
    };
    reviewScope: string;
    statements?: ReviewStatement[];
    subjectResourceId?: string;
    subjectType: SubjectType;
    supersedesReviewId?: string;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const owner = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const [responsible] = await transaction
      .select({ role: caseMemberships.role, userId: caseMemberships.userId })
      .from(caseMemberships)
      .where(
        and(
          eq(caseMemberships.caseId, input.caseId),
          eq(caseMemberships.id, input.responsibleCaseMembershipId),
        ),
      )
      .limit(1);
    if (
      !responsible ||
      ![
        "attorney",
        "lender",
        "accountant",
        "mediator",
        "support_professional",
      ].includes(responsible.role)
    ) {
      throw new AuthorizationDeniedError();
    }
    await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "read",
      userId: responsible.userId,
    });
    const evidence = await evidenceRows(
      transaction,
      input.caseId,
      input.evidence,
    );
    if (input.subjectType === "document_set" && evidence.length === 0) {
      throw new Error("Document-set reviews require exact version evidence");
    }
    await requireEvidenceAccess(
      transaction,
      input.caseId,
      responsible.userId,
      evidence,
    );

    const requiredConsents = [
      [input.responsibleGrantConsents.viewConsentId, "view"],
      [input.responsibleGrantConsents.contributeConsentId, "contribute"],
    ] as const;
    for (const [consentId, operation] of requiredConsents) {
      const [consent] = await transaction
        .select({ id: disclosureConsents.id })
        .from(disclosureConsents)
        .where(
          and(
            eq(disclosureConsents.id, consentId),
            eq(disclosureConsents.caseId, input.caseId),
            eq(
              disclosureConsents.recipientCaseMembershipId,
              input.responsibleCaseMembershipId,
            ),
            eq(disclosureConsents.classification, input.classification),
            eq(disclosureConsents.operation, operation),
            eq(disclosureConsents.status, "active"),
            sql`${disclosureConsents.effectiveAt} <= now()`,
            sql`(${disclosureConsents.expiresAt} is null or ${disclosureConsents.expiresAt} > now())`,
            sql`${disclosureConsents.revokedAt} is null`,
          ),
        )
        .limit(1);
      if (!consent) throw new AuthorizationDeniedError();
    }

    const [resource] = await transaction
      .insert(caseResources)
      .values({
        caseId: input.caseId,
        classification: input.classification,
        ownerCaseMembershipId: owner.caseMembershipId,
        type: "professional_review",
      })
      .returning();
    if (!resource) throw new Error("Review resource creation failed");
    const [review] = await transaction
      .insert(professionalReviews)
      .values({
        caseId: input.caseId,
        caseResourceId: resource.id,
        createdByCaseMembershipId: owner.caseMembershipId,
        responsibleCaseMembershipId: input.responsibleCaseMembershipId,
        subjectResourceId: input.subjectResourceId,
        subjectType: input.subjectType,
        supersedesReviewId: input.supersedesReviewId,
      })
      .returning();
    if (!review) throw new Error("Professional review creation failed");
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
      ...requiredConsents.map(([sourceConsentId, operation]) => ({
        basis: "explicit_consent" as const,
        caseId: input.caseId,
        classification: input.classification,
        granteeCaseMembershipId: input.responsibleCaseMembershipId,
        operation,
        resourceId: resource.id,
        sourceConsentId,
      })),
    ]);
    const [revision] = await transaction
      .insert(professionalReviewRevisions)
      .values({
        caseId: input.caseId,
        createdByCaseMembershipId: owner.caseMembershipId,
        decisionContext: input.decisionContext,
        professionalReviewId: review.id,
        reviewScope: input.reviewScope,
        revision: 1,
        status: "assigned",
      })
      .returning();
    if (!revision)
      throw new Error("Professional review revision creation failed");
    await insertRevisionDetails(transaction, {
      caseId: input.caseId,
      evidence,
      professionalReviewId: review.id,
      reviewRevisionId: revision.id,
      statements: input.statements ?? [],
    });
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "professional_review.created",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: review.id,
        resourceType: "professional_review",
      }),
    );
    return { resource, review, revision };
  });
}

export async function appendProfessionalReviewRevision(
  database: Database,
  input: {
    caseId: string;
    decisionContext: string;
    evidence: EvidenceReference[];
    professionalReviewId: string;
    reviewScope: string;
    statements?: ReviewStatement[];
    status: ReviewStatus;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const [review] = await transaction
      .select()
      .from(professionalReviews)
      .where(
        and(
          eq(professionalReviews.caseId, input.caseId),
          eq(professionalReviews.id, input.professionalReviewId),
        ),
      )
      .limit(1);
    if (!review) throw new AuthorizationDeniedError();
    if (
      !(await hasEffectiveResourceAccess(transaction, {
        caseId: input.caseId,
        operation: "contribute",
        resourceId: review.caseResourceId,
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
    if (
      actor.role !== "owner" &&
      actor.caseMembershipId !== review.responsibleCaseMembershipId
    ) {
      throw new AuthorizationDeniedError();
    }
    const latestResult = await transaction.execute<{
      id: string;
      revision: number;
      status: ReviewStatus;
    }>(sql`
      select id, revision, status
      from resurgo.professional_review_revisions
      where case_id = ${input.caseId}
        and professional_review_id = ${input.professionalReviewId}
      order by revision desc
      limit 1
      for update
    `);
    const latest = latestResult.rows[0];
    if (!latest || !transitions[latest.status].includes(input.status)) {
      throw new Error("Invalid professional review transition");
    }
    const evidence = await evidenceRows(
      transaction,
      input.caseId,
      input.evidence,
    );
    await requireEvidenceAccess(
      transaction,
      input.caseId,
      input.userId,
      evidence,
    );
    const [revision] = await transaction
      .insert(professionalReviewRevisions)
      .values({
        caseId: input.caseId,
        createdByCaseMembershipId: actor.caseMembershipId,
        decisionContext: input.decisionContext,
        professionalReviewId: input.professionalReviewId,
        reviewScope: input.reviewScope,
        revision: latest.revision + 1,
        status: input.status,
        supersedesRevisionId: latest.id,
      })
      .returning();
    if (!revision)
      throw new Error("Professional review revision creation failed");
    await insertRevisionDetails(transaction, {
      caseId: input.caseId,
      evidence,
      professionalReviewId: input.professionalReviewId,
      reviewRevisionId: revision.id,
      statements: input.statements ?? [],
    });
    return revision;
  });
}

export async function recordAttorneyReviewAcknowledgement(
  database: Database,
  input: {
    action: "acknowledged" | "withdrawn";
    caseId: string;
    professionalReviewId: string;
    reviewRevisionId: string;
    statementHash: string;
    userId: string;
  },
) {
  if (!/^[0-9a-f]{64}$/u.test(input.statementHash)) {
    throw new Error("Invalid acknowledgement statement hash");
  }
  return database.transaction(async (transaction) => {
    const [review] = await transaction
      .select({ resourceId: professionalReviews.caseResourceId })
      .from(professionalReviews)
      .where(
        and(
          eq(professionalReviews.caseId, input.caseId),
          eq(professionalReviews.id, input.professionalReviewId),
        ),
      )
      .limit(1);
    if (
      !review ||
      !(await hasEffectiveResourceAccess(transaction, {
        caseId: input.caseId,
        operation: "view",
        resourceId: review.resourceId,
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
    if (actor.role !== "attorney") throw new AuthorizationDeniedError();
    const [revision] = await transaction
      .select({ id: professionalReviewRevisions.id })
      .from(professionalReviewRevisions)
      .where(
        and(
          eq(professionalReviewRevisions.caseId, input.caseId),
          eq(
            professionalReviewRevisions.professionalReviewId,
            input.professionalReviewId,
          ),
          eq(professionalReviewRevisions.id, input.reviewRevisionId),
        ),
      )
      .limit(1);
    if (!revision) throw new AuthorizationDeniedError();
    const [event] = await transaction
      .insert(professionalReviewAcknowledgements)
      .values({
        action: input.action,
        attorneyCaseMembershipId: actor.caseMembershipId,
        caseId: input.caseId,
        professionalReviewId: input.professionalReviewId,
        reviewRevisionId: input.reviewRevisionId,
        statementHash: input.statementHash,
      })
      .returning();
    return event;
  });
}
