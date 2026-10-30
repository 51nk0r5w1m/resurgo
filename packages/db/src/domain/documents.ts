import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseResources,
  disclosureConsents,
  documentContributors,
  documentLegalHoldEvents,
  documentProcessingEvents,
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
type DocumentFormat = "pdf" | "docx";
type Classification =
  "shared" | "legal" | "financial" | "personal_support" | "health";
type Confidentiality =
  | "standard"
  | "confidential"
  | "attorney_client"
  | "financial_restricted"
  | "personal_sensitive";

function assertVersionMetadata(input: {
  byteSize: number;
  contentHash: string;
  format: DocumentFormat;
  mimeType: string;
}) {
  const expectedMime =
    input.format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (
    !/^[0-9a-f]{64}$/u.test(input.contentHash) ||
    !Number.isSafeInteger(input.byteSize) ||
    input.byteSize <= 0 ||
    input.mimeType !== expectedMime
  ) {
    throw new Error("Invalid document version metadata");
  }
}

export async function createDocumentWithVersion(
  database: Database,
  input: {
    byteSize: number;
    caseId: string;
    classification: Classification;
    confidentiality: Confidentiality;
    contentHash: string;
    format: DocumentFormat;
    mimeType: string;
    retainUntil?: Date;
    retentionClass: string;
    source: "client_upload" | "professional_upload" | "generated" | "imported";
    sourceReference?: string;
    title: string;
    userId: string;
    recordInitialQuarantineEvent?: boolean;
  },
) {
  assertVersionMetadata(input);
  return database.transaction(async (transaction) => {
    const authorization = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const [resource] = await transaction
      .insert(caseResources)
      .values({
        caseId: input.caseId,
        classification: input.classification,
        ownerCaseMembershipId: authorization.caseMembershipId,
        type: "document",
      })
      .returning();
    if (!resource) throw new Error("Document resource creation failed");

    const [document] = await transaction
      .insert(documents)
      .values({
        caseId: input.caseId,
        caseResourceId: resource.id,
        confidentiality: input.confidentiality,
        format: input.format,
        ownerCaseMembershipId: authorization.caseMembershipId,
        retentionClass: input.retentionClass,
        retainUntil: input.retainUntil,
        title: input.title,
      })
      .returning();
    if (!document) throw new Error("Document creation failed");

    const [version] = await transaction
      .insert(documentVersions)
      .values({
        byteSize: input.byteSize,
        caseId: input.caseId,
        contentHash: input.contentHash,
        createdByCaseMembershipId: authorization.caseMembershipId,
        documentId: document.id,
        mimeType: input.mimeType,
        source: input.source,
        sourceReference: input.sourceReference,
        versionNumber: 1,
      })
      .returning();
    if (!version) throw new Error("Document version creation failed");

    if (input.recordInitialQuarantineEvent !== false) {
      await transaction.insert(documentProcessingEvents).values({
        actorCaseMembershipId: authorization.caseMembershipId,
        caseId: input.caseId,
        documentId: document.id,
        documentVersionId: version.id,
        status: "quarantined",
      });
    }
    await transaction.insert(documentContributors).values({
      caseId: input.caseId,
      caseMembershipId: authorization.caseMembershipId,
      documentId: document.id,
      role: "owner",
    });
    await transaction.insert(resourceGrants).values(
      (["view", "download", "share", "contribute"] as const).map(
        (operation) => ({
          basis: "case_owner" as const,
          caseId: input.caseId,
          classification: input.classification,
          granteeCaseMembershipId: authorization.caseMembershipId,
          operation,
          resourceId: resource.id,
        }),
      ),
    );

    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "document.created",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: document.id,
        resourceType: "document",
      }),
    );
    return { document, resource, version };
  });
}

export async function recordDocumentProcessingEvent(
  database: Database,
  input: {
    caseId: string;
    documentId: string;
    failureCode?: string;
    status: "quarantined" | "rejected";
    userId: string;
    versionId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const authorization = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const [version] = await transaction
      .select({ id: documentVersions.id })
      .from(documentVersions)
      .where(
        and(
          eq(documentVersions.caseId, input.caseId),
          eq(documentVersions.documentId, input.documentId),
          eq(documentVersions.id, input.versionId),
        ),
      )
      .limit(1);
    if (!version) throw new AuthorizationDeniedError();
    const [event] = await transaction
      .insert(documentProcessingEvents)
      .values({
        actorCaseMembershipId: authorization.caseMembershipId,
        caseId: input.caseId,
        documentId: input.documentId,
        documentVersionId: input.versionId,
        failureCode: input.failureCode,
        status: input.status,
      })
      .returning();
    return event;
  });
}

export async function listAuthorizedDocuments(
  database: Database,
  input: { caseId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "read" });
  const result = await database.execute<{
    confidentiality: Confidentiality;
    created_at: Date;
    document_id: string;
    format: DocumentFormat;
    processing_status: string;
    resource_id: string;
    title: string;
    version_id: string;
    version_number: number;
  }>(sql`
    select document.id as document_id, document.title, document.format,
      document.confidentiality, document.created_at, document.case_resource_id as resource_id,
      version.id as version_id, version.version_number,
      latest_processing.status as processing_status
    from resurgo.documents document
    inner join lateral (
      select id, version_number
      from resurgo.document_versions
      where case_id = document.case_id and document_id = document.id
      order by version_number desc
      limit 1
    ) version on true
    inner join lateral (
      select status
      from resurgo.document_processing_events
      where case_id = document.case_id
        and document_id = document.id
        and document_version_id = version.id
      order by occurred_at desc, id desc
      limit 1
    ) latest_processing on true
    where document.case_id = ${input.caseId}
    order by document.created_at desc
  `);
  const authorized = [];
  for (const row of result.rows) {
    if (
      await hasEffectiveResourceAccess(database, {
        caseId: input.caseId,
        operation: "view",
        resourceId: row.resource_id,
        userId: input.userId,
      })
    ) {
      authorized.push(row);
    }
  }
  return authorized;
}

export async function getAuthorizedAvailableDocumentVersion(
  database: Database,
  input: {
    caseId: string;
    documentId: string;
    operation: "download" | "view";
    userId: string;
    versionId: string;
  },
) {
  const [row] = await database
    .select({
      contentHash: documentVersions.contentHash,
      documentId: documents.id,
      format: documents.format,
      mimeType: documentVersions.mimeType,
      resourceId: documents.caseResourceId,
      versionId: documentVersions.id,
    })
    .from(documentVersions)
    .innerJoin(
      documents,
      and(
        eq(documents.caseId, documentVersions.caseId),
        eq(documents.id, documentVersions.documentId),
      ),
    )
    .where(
      and(
        eq(documentVersions.caseId, input.caseId),
        eq(documentVersions.documentId, input.documentId),
        eq(documentVersions.id, input.versionId),
      ),
    )
    .limit(1);
  if (
    !row ||
    !(await hasEffectiveResourceAccess(database, {
      caseId: input.caseId,
      operation: input.operation,
      resourceId: row.resourceId,
      userId: input.userId,
    }))
  ) {
    throw new AuthorizationDeniedError();
  }
  const latest = await database.execute<{ status: string }>(sql`
    select status
    from resurgo.document_processing_events
    where case_id = ${input.caseId}
      and document_id = ${input.documentId}
      and document_version_id = ${input.versionId}
    order by occurred_at desc, id desc
    limit 1
  `);
  if (latest.rows[0]?.status !== "available") {
    throw new AuthorizationDeniedError();
  }
  return row;
}

export async function recordDocumentAccessAudit(
  database: Database,
  input: {
    action: "document.downloaded" | "document.previewed";
    caseId: string;
    userId: string;
    versionId: string;
  },
) {
  await database.insert(auditEvents).values(
    buildAuditEvent({
      action: input.action,
      actorType: "user",
      actorUserId: input.userId,
      caseId: input.caseId,
      outcome: "success",
      resourceId: input.versionId,
      resourceType: "document_version",
    }),
  );
}

export async function addDocumentVersion(
  database: Database,
  input: {
    byteSize: number;
    caseId: string;
    contentHash: string;
    documentId: string;
    format: DocumentFormat;
    mimeType: string;
    source: "client_upload" | "professional_upload" | "generated" | "imported";
    sourceReference?: string;
    userId: string;
  },
) {
  assertVersionMetadata(input);
  return database.transaction(async (transaction) => {
    const [document] = await transaction
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.caseId, input.caseId),
          eq(documents.id, input.documentId),
        ),
      )
      .limit(1);
    if (!document || document.format !== input.format) {
      throw new AuthorizationDeniedError();
    }
    const allowed = await hasEffectiveResourceAccess(transaction, {
      caseId: input.caseId,
      operation: "contribute",
      resourceId: document.caseResourceId,
      userId: input.userId,
    });
    if (!allowed) throw new AuthorizationDeniedError();

    const member = await transaction.execute<{ id: string }>(sql`
      select contributor.id
      from resurgo.document_contributors contributor
      inner join resurgo.case_memberships membership
        on membership.id = contributor.case_membership_id
        and membership.case_id = contributor.case_id
      where contributor.case_id = ${input.caseId}
        and contributor.document_id = ${input.documentId}
        and contributor.status = 'active'
        and membership.user_id = ${input.userId}
        and membership.status = 'active'
      limit 1
    `);
    if (!member.rows[0]) throw new AuthorizationDeniedError();

    const latestResult = await transaction.execute<{
      id: string;
      version_number: number;
    }>(sql`
      select id, version_number
      from resurgo.document_versions
      where case_id = ${input.caseId} and document_id = ${input.documentId}
      order by version_number desc
      limit 1
      for update
    `);
    const latest = latestResult.rows[0];
    if (!latest) throw new AuthorizationDeniedError();
    const authorization = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "read",
      userId: input.userId,
    });
    const [version] = await transaction
      .insert(documentVersions)
      .values({
        byteSize: input.byteSize,
        caseId: input.caseId,
        contentHash: input.contentHash,
        createdByCaseMembershipId: authorization.caseMembershipId,
        documentId: input.documentId,
        mimeType: input.mimeType,
        source: input.source,
        sourceReference: input.sourceReference,
        supersedesVersionId: latest.id,
        versionNumber: latest.version_number + 1,
      })
      .returning();
    if (!version) throw new Error("Document version creation failed");
    await transaction.insert(documentProcessingEvents).values({
      actorCaseMembershipId: authorization.caseMembershipId,
      caseId: input.caseId,
      documentId: input.documentId,
      documentVersionId: version.id,
      status: "quarantined",
    });
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "document.version.created",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: version.id,
        resourceType: "document_version",
      }),
    );
    return version;
  });
}

export async function grantDocumentAccess(
  database: Database,
  input: {
    caseId: string;
    documentId: string;
    expiresAt?: Date;
    granteeCaseMembershipId: string;
    grants: Array<{
      operation: "view" | "download" | "share" | "contribute";
      sourceConsentId: string;
    }>;
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
      .select({
        classification: caseResources.classification,
        resourceId: documents.caseResourceId,
      })
      .from(documents)
      .innerJoin(caseResources, eq(caseResources.id, documents.caseResourceId))
      .where(
        and(
          eq(documents.caseId, input.caseId),
          eq(documents.id, input.documentId),
        ),
      )
      .limit(1);
    if (!document || input.grants.length === 0) {
      throw new AuthorizationDeniedError();
    }
    const consentIds = input.grants.map(
      ({ sourceConsentId }) => sourceConsentId,
    );
    const consents = await transaction
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
            input.granteeCaseMembershipId,
          ),
          eq(disclosureConsents.classification, document.classification),
          eq(disclosureConsents.status, "active"),
          sql`${disclosureConsents.effectiveAt} <= now()`,
          sql`(${disclosureConsents.expiresAt} is null or ${disclosureConsents.expiresAt} > now())`,
          sql`${disclosureConsents.revokedAt} is null`,
        ),
      );
    if (
      !input.grants.every(
        ({ operation, sourceConsentId }) =>
          consentIds.includes(sourceConsentId) &&
          consents.some(
            (row) => row.id === sourceConsentId && row.operation === operation,
          ),
      )
    ) {
      throw new AuthorizationDeniedError();
    }
    const grants = await transaction
      .insert(resourceGrants)
      .values(
        input.grants.map(({ operation, sourceConsentId }) => ({
          basis: "explicit_consent" as const,
          caseId: input.caseId,
          classification: document.classification,
          expiresAt: input.expiresAt,
          granteeCaseMembershipId: input.granteeCaseMembershipId,
          operation,
          resourceId: document.resourceId,
          sourceConsentId,
        })),
      )
      .returning();
    if (input.grants.some(({ operation }) => operation === "contribute")) {
      const [activeContributor] = await transaction
        .select({ id: documentContributors.id })
        .from(documentContributors)
        .where(
          and(
            eq(documentContributors.documentId, input.documentId),
            eq(
              documentContributors.caseMembershipId,
              input.granteeCaseMembershipId,
            ),
            eq(documentContributors.role, "uploader"),
            eq(documentContributors.status, "active"),
          ),
        )
        .limit(1);
      if (!activeContributor) {
        await transaction.insert(documentContributors).values({
          caseId: input.caseId,
          caseMembershipId: input.granteeCaseMembershipId,
          documentId: input.documentId,
          role: "uploader",
        });
      }
    }
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "document.access.granted",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: input.documentId,
        resourceType: "document",
      }),
    );
    return grants;
  });
}

export async function recordDocumentLegalHold(
  database: Database,
  input: {
    action: "placed" | "released";
    caseId: string;
    documentId: string;
    reasonCode: string;
    userId: string;
  },
) {
  return database.transaction(async (transaction) => {
    const authorization = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const [document] = await transaction
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.caseId, input.caseId),
          eq(documents.id, input.documentId),
        ),
      )
      .limit(1);
    if (!document) throw new AuthorizationDeniedError();
    const [latest] = await transaction
      .select({ action: documentLegalHoldEvents.action })
      .from(documentLegalHoldEvents)
      .where(eq(documentLegalHoldEvents.documentId, input.documentId))
      .orderBy(desc(documentLegalHoldEvents.occurredAt))
      .limit(1);
    if (
      (input.action === "placed" && latest?.action === "placed") ||
      (input.action === "released" && latest?.action !== "placed")
    ) {
      throw new Error("Invalid legal hold transition");
    }
    const [event] = await transaction
      .insert(documentLegalHoldEvents)
      .values({
        action: input.action,
        actorCaseMembershipId: authorization.caseMembershipId,
        caseId: input.caseId,
        documentId: input.documentId,
        reasonCode: input.reasonCode,
      })
      .returning();
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: `document.legal_hold.${input.action}`,
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: input.documentId,
        resourceType: "document",
      }),
    );
    return event;
  });
}
