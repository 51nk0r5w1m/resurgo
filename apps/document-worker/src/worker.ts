import {
  auditEvents,
  buildAuditEvent,
  type createDatabase,
  documentProcessingEvents,
} from "@resurgo/db";
import {
  DocumentProcessingError,
  documentObjectKeys,
  processQuarantinedDocument,
  type PrivateObjectStorage,
} from "@resurgo/documents/worker";
import { sql } from "drizzle-orm";

type Database = ReturnType<typeof createDatabase>["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type WorkItem = {
  caseId: string;
  contentHash: string;
  documentId: string;
  mimeType: string;
  versionId: string;
};

async function claim(transaction: Transaction): Promise<WorkItem | undefined> {
  const result = await transaction.execute<{
    case_id: string;
    content_hash: string;
    document_id: string;
    id: string;
    mime_type: string;
  }>(sql`
      select version.id, version.case_id, version.document_id,
        version.content_hash, version.mime_type
      from resurgo.document_versions version
      inner join lateral (
        select status, occurred_at
        from resurgo.document_processing_events event
        where event.document_version_id = version.id
        order by occurred_at desc, id desc
        limit 1
      ) latest on true
      where latest.status = 'quarantined'
        or (latest.status = 'processing' and latest.occurred_at < now() - interval '5 minutes')
      order by version.created_at
      limit 1
      for update of version skip locked
  `);
  const row = result.rows[0];
  if (!row) return undefined;
  await transaction.insert(documentProcessingEvents).values({
    caseId: row.case_id,
    documentId: row.document_id,
    documentVersionId: row.id,
    status: "processing",
  });
  return {
    caseId: row.case_id,
    contentHash: row.content_hash,
    documentId: row.document_id,
    mimeType: row.mime_type,
    versionId: row.id,
  };
}

export async function processNextDocument(input: {
  database: Database;
  scan(bytes: Uint8Array): Promise<{ clean: true }>;
  storage: PrivateObjectStorage;
}) {
  return input.database.transaction(async (transaction) => {
    // Keep the version row locked for the complete attempt. A second worker's
    // SKIP LOCKED query cannot reclaim a genuinely long-running scan merely
    // because its processing event is older than the retry interval.
    const item = await claim(transaction);
    if (!item) return false;
    try {
      await processQuarantinedDocument({
        caseId: item.caseId,
        contentHash: item.contentHash,
        declaredMimeType: item.mimeType,
        documentId: item.documentId,
        scan: input.scan,
        storage: input.storage,
        versionId: item.versionId,
      });
      await transaction.insert(documentProcessingEvents).values({
        caseId: item.caseId,
        documentId: item.documentId,
        documentVersionId: item.versionId,
        status: "available",
      });
      await transaction.insert(auditEvents).values(
        buildAuditEvent({
          action: "document.processing.available",
          actorType: "system",
          caseId: item.caseId,
          outcome: "success",
          resourceId: item.versionId,
          resourceType: "document_version",
        }),
      );
    } catch (error) {
      if (error instanceof DocumentProcessingError) {
        if (error.removeFromQuarantine) {
          const keys = documentObjectKeys(item);
          await input.storage.delete(keys.quarantine).catch(() => undefined);
          await transaction.insert(documentProcessingEvents).values({
            caseId: item.caseId,
            documentId: item.documentId,
            documentVersionId: item.versionId,
            failureCode: error.failureCode,
            status: "rejected",
          });
          await transaction.insert(auditEvents).values(
            buildAuditEvent({
              action: "document.processing.rejected",
              actorType: "system",
              caseId: item.caseId,
              outcome: "failure",
              reasonCode: error.failureCode,
              resourceId: item.versionId,
              resourceType: "document_version",
            }),
          );
        }
        // Scanner and storage failures retain a committed processing marker
        // and can be retried after the lease interval. The row lock prevents
        // another worker from racing this still-active attempt.
        return true;
      }
      throw error;
    }
    return true;
  });
}
