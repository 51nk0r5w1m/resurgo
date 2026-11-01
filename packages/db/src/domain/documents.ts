import { and, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import {
  auditEvents,
  caseResources,
  disclosureConsents,
  documentCommentEvents,
  documentComments,
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
import { invalidateReviewsForEvidenceChange } from "./reviews";

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
    const version = await transaction.execute<{ id: string }>(sql`
      select id
      from resurgo.document_versions
      where case_id = ${input.caseId}
        and document_id = ${input.documentId}
        and id = ${input.versionId}
      for update
    `);
    if (!version.rows[0]) throw new AuthorizationDeniedError();
    const [latest] = await transaction
      .select({ status: documentProcessingEvents.status })
      .from(documentProcessingEvents)
      .where(
        and(
          eq(documentProcessingEvents.caseId, input.caseId),
          eq(documentProcessingEvents.documentId, input.documentId),
          eq(documentProcessingEvents.documentVersionId, input.versionId),
        ),
      )
      .orderBy(
        desc(documentProcessingEvents.occurredAt),
        desc(documentProcessingEvents.id),
      )
      .limit(1);
    const validTransition =
      (input.status === "quarantined" && latest === undefined) ||
      (input.status === "rejected" &&
        (latest === undefined ||
          latest.status === "quarantined" ||
          latest.status === "processing"));
    if (!validTransition) {
      throw new Error("Invalid document processing status transition");
    }
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
    classification: Classification;
    created_at: Date;
    byte_size: number;
    document_id: string;
    format: DocumentFormat;
    processing_status: string;
    resource_id: string;
    title: string;
    version_id: string;
    version_number: number;
  }>(sql`
    select document.id as document_id, document.title, document.format,
      document.confidentiality, resource.classification, document.created_at,
      document.case_resource_id as resource_id,
      version.id as version_id, version.version_number, version.byte_size,
      latest_processing.status as processing_status
    from resurgo.documents document
    inner join resurgo.case_resources resource
      on resource.case_id = document.case_id and resource.id = document.case_resource_id
    inner join lateral (
      select id, version_number, byte_size
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
      and document.archived_at is null
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
    recordInitialQuarantineEvent?: boolean;
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
    await invalidateReviewsForEvidenceChange(transaction, {
      actorCaseMembershipId: authorization.caseMembershipId,
      actorUserId: input.userId,
      caseId: input.caseId,
      supersededDocumentVersionId: latest.id,
    });
    if (input.recordInitialQuarantineEvent !== false) {
      await transaction.insert(documentProcessingEvents).values({
        actorCaseMembershipId: authorization.caseMembershipId,
        caseId: input.caseId,
        documentId: input.documentId,
        documentVersionId: version.id,
        status: "quarantined",
      });
    }
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

export async function getAuthorizedDocumentDetail(
  database: Database,
  input: { caseId: string; documentId: string; userId: string },
) {
  await requireCaseAuthorization(database, { ...input, operation: "read" });
  const [document] = await database
    .select({
      archivedAt: documents.archivedAt,
      classification: caseResources.classification,
      confidentiality: documents.confidentiality,
      createdAt: documents.createdAt,
      format: documents.format,
      id: documents.id,
      resourceId: documents.caseResourceId,
      retainUntil: documents.retainUntil,
      retentionClass: documents.retentionClass,
      title: documents.title,
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
  if (
    !document ||
    !(await hasEffectiveResourceAccess(database, {
      caseId: input.caseId,
      operation: "view",
      resourceId: document.resourceId,
      userId: input.userId,
    }))
  ) {
    throw new AuthorizationDeniedError();
  }
  const versionResult = await database.execute<{
    byte_size: number;
    content_hash: string;
    created_at: Date;
    id: string;
    mime_type: string;
    processing_status: string;
    source: string;
    supersedes_version_id: string | null;
    version_number: number;
  }>(sql`
    select version.id, version.version_number, version.content_hash,
      version.byte_size, version.mime_type, version.source,
      version.supersedes_version_id, version.created_at,
      latest_processing.status as processing_status
    from resurgo.document_versions version
    inner join lateral (
      select status
      from resurgo.document_processing_events
      where case_id = version.case_id
        and document_id = version.document_id
        and document_version_id = version.id
      order by occurred_at desc, id desc
      limit 1
    ) latest_processing on true
    where version.case_id = ${input.caseId}
      and version.document_id = ${input.documentId}
    order by version.version_number desc
  `);
  const comments = await database.execute<{
    anchor: unknown;
    author_name: string;
    body: string;
    created_at: Date;
    document_version_id: string;
    id: string;
    kind: "comment" | "highlight";
    parent_comment_id: string | null;
    status: "open" | "resolved" | "reopened";
  }>(sql`
    select comment.id, comment.document_version_id, comment.kind,
      comment.body, comment.anchor, comment.parent_comment_id,
      comment.created_at, author.name as author_name,
      latest_event.status
    from resurgo.document_comments comment
    inner join resurgo.case_memberships membership
      on membership.case_id = comment.case_id
      and membership.id = comment.author_case_membership_id
    inner join auth.user author on author.id = membership.user_id
    inner join lateral (
      select status from resurgo.document_comment_events
      where case_id = comment.case_id and comment_id = comment.id
      order by occurred_at desc, id desc limit 1
    ) latest_event on true
    where comment.case_id = ${input.caseId}
      and comment.document_id = ${input.documentId}
    order by comment.created_at asc, comment.id asc
  `);
  return { comments: comments.rows, document, versions: versionResult.rows };
}

export async function addDocumentComment(
  database: Database,
  input: {
    anchor?: unknown;
    body: string;
    caseId: string;
    documentId: string;
    kind: "comment" | "highlight";
    parentCommentId?: string;
    userId: string;
    versionId: string;
  },
) {
  const body = input.body.trim();
  if (body.length < 1 || body.length > 4000) {
    throw new Error("Document comment is outside the permitted range");
  }
  return database.transaction(async (transaction) => {
    const [document] = await transaction
      .select({ resourceId: documents.caseResourceId })
      .from(documents)
      .innerJoin(
        documentVersions,
        and(
          eq(documentVersions.caseId, documents.caseId),
          eq(documentVersions.documentId, documents.id),
        ),
      )
      .where(
        and(
          eq(documents.caseId, input.caseId),
          eq(documents.id, input.documentId),
          eq(documentVersions.id, input.versionId),
        ),
      )
      .limit(1);
    if (
      !document ||
      !(await hasEffectiveResourceAccess(transaction, {
        caseId: input.caseId,
        operation: "contribute",
        resourceId: document.resourceId,
        userId: input.userId,
      }))
    ) {
      throw new AuthorizationDeniedError();
    }
    const authorization = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "read",
      userId: input.userId,
    });
    const [comment] = await transaction
      .insert(documentComments)
      .values({
        anchor: input.anchor,
        authorCaseMembershipId: authorization.caseMembershipId,
        body,
        caseId: input.caseId,
        documentId: input.documentId,
        documentVersionId: input.versionId,
        kind: input.kind,
        parentCommentId: input.parentCommentId,
      })
      .returning();
    if (!comment) throw new Error("Document comment creation failed");
    await transaction.insert(documentCommentEvents).values({
      actorCaseMembershipId: authorization.caseMembershipId,
      caseId: input.caseId,
      commentId: comment.id,
      status: "open",
    });
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: `document.${input.kind}.created`,
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: comment.id,
        resourceType: "document_comment",
      }),
    );
    return comment;
  });
}

export async function archiveDocument(
  database: Database,
  input: { caseId: string; documentId: string; userId: string },
) {
  return database.transaction(async (transaction) => {
    const authorization = await requireCaseAuthorization(transaction, {
      caseId: input.caseId,
      operation: "manage",
      userId: input.userId,
    });
    const activeHold = await transaction.execute<{ active: boolean }>(sql`
      select coalesce((
        select action = 'placed'
        from resurgo.document_legal_hold_events
        where case_id = ${input.caseId} and document_id = ${input.documentId}
        order by occurred_at desc, id desc limit 1
      ), false) as active
    `);
    if (activeHold.rows[0]?.active) {
      throw new Error("Document is subject to an active legal hold");
    }
    const archivedAt = new Date();
    const [document] = await transaction
      .update(documents)
      .set({
        archivedAt,
        archivedByCaseMembershipId: authorization.caseMembershipId,
      })
      .where(
        and(
          eq(documents.caseId, input.caseId),
          eq(documents.id, input.documentId),
          sql`${documents.archivedAt} is null`,
        ),
      )
      .returning();
    if (!document) throw new AuthorizationDeniedError();
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: "document.archived",
        actorType: "user",
        actorUserId: input.userId,
        caseId: input.caseId,
        outcome: "success",
        resourceId: input.documentId,
        resourceType: "document",
      }),
    );
    return document;
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
        expiresAt: disclosureConsents.expiresAt,
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
        input.grants.map(({ operation, sourceConsentId }) => {
          const consent = consents.find(({ id }) => id === sourceConsentId);
          if (!consent) throw new AuthorizationDeniedError();
          const expiresAt =
            consent.expiresAt &&
            (!input.expiresAt || consent.expiresAt < input.expiresAt)
              ? consent.expiresAt
              : input.expiresAt;
          return {
            basis: "explicit_consent" as const,
            caseId: input.caseId,
            classification: document.classification,
            expiresAt,
            granteeCaseMembershipId: input.granteeCaseMembershipId,
            operation,
            resourceId: document.resourceId,
            sourceConsentId,
          };
        }),
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
        await transaction
          .insert(documentContributors)
          .values({
            caseId: input.caseId,
            caseMembershipId: input.granteeCaseMembershipId,
            documentId: input.documentId,
            role: "uploader",
          })
          .onConflictDoNothing({
            target: [
              documentContributors.documentId,
              documentContributors.caseMembershipId,
              documentContributors.role,
            ],
            where: sql`${documentContributors.status} = 'active'`,
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
    // Serialize the lifecycle decision on the stable document row. The event
    // table is append-only, so it cannot itself provide a row to lock before
    // the first hold is placed.
    const document = await transaction.execute<{ id: string }>(sql`
      select id
      from resurgo.documents
      where case_id = ${input.caseId} and id = ${input.documentId}
      for update
    `);
    if (!document.rows[0]) throw new AuthorizationDeniedError();
    const [latest] = await transaction
      .select({ action: documentLegalHoldEvents.action })
      .from(documentLegalHoldEvents)
      .where(eq(documentLegalHoldEvents.documentId, input.documentId))
      .orderBy(
        desc(documentLegalHoldEvents.occurredAt),
        desc(documentLegalHoldEvents.id),
      )
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
