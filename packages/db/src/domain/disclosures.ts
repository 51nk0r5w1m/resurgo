import { createHash } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseMemberships,
  caseResources,
  disclosureConsents,
  documents,
  professionalReviews,
  resourceGrants,
  user,
} from "../schema";
import {
  AuthorizationDeniedError,
  requireCaseAuthorization,
} from "./authorization";
import { buildAuditEvent } from "./audit";

type Database = NodePgDatabase<typeof schema>;

export async function authorizeDocumentDisclosure(
  database: Database,
  input: {
    caseId: string;
    documentId: string;
    operations: Array<"contribute" | "download" | "view">;
    purpose: string;
    recipientCaseMembershipId: string;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const owner = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const operations = [...new Set(input.operations)];
    if (!operations.length || !input.purpose.trim()) {
      throw new AuthorizationDeniedError();
    }
    const [recipient] = await transaction
      .select({ role: caseMemberships.role, userId: caseMemberships.userId })
      .from(caseMemberships)
      .where(
        and(
          eq(caseMemberships.caseId, input.caseId),
          eq(caseMemberships.id, input.recipientCaseMembershipId),
          eq(caseMemberships.status, "active"),
        ),
      )
      .limit(1);
    if (
      !recipient ||
      ![
        "attorney",
        "lender",
        "accountant",
        "mediator",
        "support_professional",
      ].includes(recipient.role)
    ) {
      throw new AuthorizationDeniedError();
    }
    await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "read",
      userId: recipient.userId,
    });
    const [document] = await transaction
      .select({
        classification: caseResources.classification,
        resourceId: documents.caseResourceId,
      })
      .from(documents)
      .innerJoin(
        caseResources,
        and(
          eq(caseResources.caseId, documents.caseId),
          eq(caseResources.id, documents.caseResourceId),
        ),
      )
      .where(
        and(
          eq(documents.caseId, input.caseId),
          eq(documents.id, input.documentId),
        ),
      )
      .limit(1);
    if (!document) throw new AuthorizationDeniedError();

    const consents = await transaction
      .insert(disclosureConsents)
      .values(
        operations.map((operation) => ({
          caseId: input.caseId,
          classification: document.classification,
          grantorCaseMembershipId: owner.caseMembershipId,
          operation,
          purpose: input.purpose.trim(),
          recipientCaseMembershipId: input.recipientCaseMembershipId,
          termsHash: createHash("sha256")
            .update(
              JSON.stringify({
                classification: document.classification,
                documentId: input.documentId,
                operation,
                purpose: input.purpose.trim(),
                recipientCaseMembershipId: input.recipientCaseMembershipId,
              }),
            )
            .digest("hex"),
        })),
      )
      .returning();
    const grants = await transaction
      .insert(resourceGrants)
      .values(
        consents.map((consent) => ({
          basis: "explicit_consent" as const,
          caseId: input.caseId,
          classification: document.classification,
          granteeCaseMembershipId: input.recipientCaseMembershipId,
          operation: consent.operation,
          resourceId: document.resourceId,
          sourceConsentId: consent.id,
        })),
      )
      .returning();
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "document.disclosure.authorized",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: input.documentId,
        resourceType: "document",
      }),
    );
    return { consents, grants };
  });
}

export async function authorizeReviewDisclosure(
  database: Database,
  input: {
    caseId: string;
    professionalReviewId: string;
    purpose: string;
    recipientCaseMembershipId: string;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const owner = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const [recipient] = await transaction
      .select({ role: caseMemberships.role, userId: caseMemberships.userId })
      .from(caseMemberships)
      .where(
        and(
          eq(caseMemberships.caseId, input.caseId),
          eq(caseMemberships.id, input.recipientCaseMembershipId),
          eq(caseMemberships.status, "active"),
          eq(caseMemberships.role, "attorney"),
        ),
      )
      .limit(1);
    if (!recipient || !input.purpose.trim())
      throw new AuthorizationDeniedError();
    await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "read",
      userId: recipient.userId,
    });
    const [review] = await transaction
      .select({
        classification: caseResources.classification,
        resourceId: professionalReviews.caseResourceId,
      })
      .from(professionalReviews)
      .innerJoin(
        caseResources,
        eq(caseResources.id, professionalReviews.caseResourceId),
      )
      .where(
        and(
          eq(professionalReviews.caseId, input.caseId),
          eq(professionalReviews.id, input.professionalReviewId),
        ),
      )
      .limit(1);
    if (!review) throw new AuthorizationDeniedError();
    const [consent] = await transaction
      .insert(disclosureConsents)
      .values({
        caseId: input.caseId,
        classification: review.classification,
        grantorCaseMembershipId: owner.caseMembershipId,
        operation: "view",
        purpose: input.purpose.trim(),
        recipientCaseMembershipId: input.recipientCaseMembershipId,
        termsHash: createHash("sha256")
          .update(
            JSON.stringify({
              professionalReviewId: input.professionalReviewId,
              purpose: input.purpose.trim(),
              recipientCaseMembershipId: input.recipientCaseMembershipId,
            }),
          )
          .digest("hex"),
      })
      .returning();
    if (!consent) throw new Error("Review consent creation failed");
    const [grant] = await transaction
      .insert(resourceGrants)
      .values({
        basis: "explicit_consent",
        caseId: input.caseId,
        classification: review.classification,
        granteeCaseMembershipId: input.recipientCaseMembershipId,
        operation: "view",
        resourceId: review.resourceId,
        sourceConsentId: consent.id,
      })
      .returning();
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "professional_review.disclosure.authorized",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: input.professionalReviewId,
        resourceType: "professional_review",
      }),
    );
    return { consent, grant };
  });
}

export async function revokeDocumentDisclosure(
  database: Database,
  input: {
    caseId: string;
    documentId: string;
    recipientCaseMembershipId: string;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const [document] = await transaction
      .select({ resourceId: documents.caseResourceId })
      .from(documents)
      .where(
        and(
          eq(documents.caseId, input.caseId),
          eq(documents.id, input.documentId),
        ),
      )
      .limit(1);
    if (!document) throw new AuthorizationDeniedError();
    const active = await transaction
      .select({ id: disclosureConsents.id })
      .from(disclosureConsents)
      .where(
        and(
          eq(disclosureConsents.caseId, input.caseId),
          eq(
            disclosureConsents.recipientCaseMembershipId,
            input.recipientCaseMembershipId,
          ),
          eq(disclosureConsents.status, "active"),
          sql`exists (
            select 1 from resurgo.resource_grants grant_record
            where grant_record.source_consent_id = ${disclosureConsents.id}
              and grant_record.resource_id = ${document.resourceId}
              and grant_record.status = 'active'
          )`,
        ),
      );
    if (!active.length) throw new AuthorizationDeniedError();
    const revokedAt = new Date();
    const consentIds = active.map(({ id }) => id);
    await transaction
      .update(disclosureConsents)
      .set({ revokedAt, status: "revoked" })
      .where(inArray(disclosureConsents.id, consentIds));
    await transaction
      .update(resourceGrants)
      .set({ revokedAt, status: "revoked" })
      .where(
        and(
          eq(resourceGrants.resourceId, document.resourceId),
          eq(
            resourceGrants.granteeCaseMembershipId,
            input.recipientCaseMembershipId,
          ),
          inArray(resourceGrants.sourceConsentId, consentIds),
          eq(resourceGrants.status, "active"),
        ),
      );
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "document.disclosure.revoked",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: input.documentId,
        resourceType: "document",
      }),
    );
  });
}

export async function listAuthorizedDocumentDisclosures(
  database: Database,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "manage" });
  return database
    .select({
      documentId: documents.id,
      documentTitle: documents.title,
      operation: disclosureConsents.operation,
      professionalName: user.name,
      purpose: disclosureConsents.purpose,
      recipientCaseMembershipId: disclosureConsents.recipientCaseMembershipId,
      status: disclosureConsents.status,
    })
    .from(disclosureConsents)
    .innerJoin(
      resourceGrants,
      eq(resourceGrants.sourceConsentId, disclosureConsents.id),
    )
    .innerJoin(
      documents,
      and(
        eq(documents.caseId, disclosureConsents.caseId),
        eq(documents.caseResourceId, resourceGrants.resourceId),
      ),
    )
    .innerJoin(
      caseMemberships,
      eq(caseMemberships.id, disclosureConsents.recipientCaseMembershipId),
    )
    .innerJoin(user, eq(user.id, caseMemberships.userId))
    .where(eq(disclosureConsents.caseId, input.caseId));
}

export async function findActiveReviewConsentIds(
  database: Database,
  input: {
    caseId: string;
    classification: (typeof schema.resourceClassification.enumValues)[number];
    recipientCaseMembershipId: string;
    userId: string;
  },
) {
  await requireCaseAuthorization(database, { ...input, operation: "manage" });
  const rows = await database
    .select({
      id: disclosureConsents.id,
      operation: disclosureConsents.operation,
    })
    .from(disclosureConsents)
    .where(
      and(
        eq(disclosureConsents.caseId, input.caseId),
        eq(
          disclosureConsents.recipientCaseMembershipId,
          input.recipientCaseMembershipId,
        ),
        eq(disclosureConsents.classification, input.classification),
        inArray(disclosureConsents.operation, ["view", "contribute"]),
        eq(disclosureConsents.status, "active"),
        sql`${disclosureConsents.effectiveAt} <= now()`,
        sql`(${disclosureConsents.expiresAt} is null or ${disclosureConsents.expiresAt} > now())`,
        sql`${disclosureConsents.revokedAt} is null`,
      ),
    );
  const view = rows.find(({ operation }) => operation === "view")?.id;
  const contribute = rows.find(
    ({ operation }) => operation === "contribute",
  )?.id;
  if (!view || !contribute) throw new AuthorizationDeniedError();
  return { contribute, view };
}
