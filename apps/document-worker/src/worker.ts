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
  leaseEventId: string;
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
  const [lease] = await transaction
    .insert(documentProcessingEvents)
    .values({
      caseId: row.case_id,
      documentId: row.document_id,
      documentVersionId: row.id,
      occurredAt: sql`clock_timestamp()`,
      status: "processing",
    })
    .returning({ id: documentProcessingEvents.id });
  if (!lease) throw new Error("Document processing lease was not created");
  return {
    caseId: row.case_id,
    contentHash: row.content_hash,
    documentId: row.document_id,
    leaseEventId: lease.id,
    mimeType: row.mime_type,
    versionId: row.id,
  };
}

async function renewLease(
  database: Database,
  item: WorkItem,
): Promise<WorkItem | undefined> {
  return database.transaction(async (transaction) => {
    const result = await transaction.execute<{ id: string; status: string }>(
      sql`
        select event.id, event.status
        from resurgo.document_versions version
        inner join lateral (
          select id, status
          from resurgo.document_processing_events
          where document_version_id = version.id
          order by occurred_at desc, id desc
          limit 1
        ) event on true
        where version.id = ${item.versionId}
        for update of version
      `,
    );
    const latest = result.rows[0];
    if (latest?.id !== item.leaseEventId || latest.status !== "processing")
      return undefined;
    const [lease] = await transaction
      .insert(documentProcessingEvents)
      .values({
        caseId: item.caseId,
        documentId: item.documentId,
        documentVersionId: item.versionId,
        occurredAt: sql`clock_timestamp()`,
        status: "processing",
      })
      .returning({ id: documentProcessingEvents.id });
    if (!lease) throw new Error("Document processing lease was not renewed");
    return {
      ...item,
      leaseEventId: lease.id,
    };
  });
}

function keepLeaseAlive(database: Database, initial: WorkItem) {
  let current = initial;
  let lost = false;
  let pending = Promise.resolve();
  const timer = setInterval(() => {
    pending = pending
      .then(async () => {
        const renewed = await renewLease(database, current);
        if (renewed) current = renewed;
        else lost = true;
      })
      .catch(() => {
        // A transient renewal failure does not prove that ownership was lost.
        // Finalization still locks the version and verifies the last known
        // lease event before appending an outcome.
      });
  }, 60_000);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await pending;
    return lost ? undefined : current;
  };
}

async function recordOutcome(
  database: Database,
  item: WorkItem,
  outcome:
    { status: "available" } | { failureCode: string; status: "rejected" },
) {
  return database.transaction(async (transaction) => {
    const result = await transaction.execute<{ id: string; status: string }>(
      sql`
        select event.id, event.status
        from resurgo.document_versions version
        inner join lateral (
          select id, status
          from resurgo.document_processing_events
          where document_version_id = version.id
          order by occurred_at desc, id desc
          limit 1
        ) event on true
        where version.id = ${item.versionId}
        for update of version
      `,
    );
    const latest = result.rows[0];
    if (latest?.id !== item.leaseEventId || latest.status !== "processing")
      return false;
    await transaction.insert(documentProcessingEvents).values({
      caseId: item.caseId,
      documentId: item.documentId,
      documentVersionId: item.versionId,
      ...(outcome.status === "rejected"
        ? { failureCode: outcome.failureCode }
        : {}),
      occurredAt: sql`clock_timestamp()`,
      status: outcome.status,
    });
    await transaction.insert(auditEvents).values(
      buildAuditEvent({
        action: `document.processing.${outcome.status}`,
        actorType: "system",
        caseId: item.caseId,
        outcome: outcome.status === "available" ? "success" : "failure",
        ...(outcome.status === "rejected"
          ? { reasonCode: outcome.failureCode }
          : {}),
        resourceId: item.versionId,
        resourceType: "document_version",
      }),
    );
    return true;
  });
}

export async function processNextDocument(input: {
  database: Database;
  scan(bytes: Uint8Array): Promise<{ clean: true }>;
  storage: PrivateObjectStorage;
}) {
  const item = await input.database.transaction(claim);
  if (!item) return false;
  const stopLease = keepLeaseAlive(input.database, item);
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
    const activeLease = await stopLease();
    if (!activeLease)
      throw new Error("Document processing lease was superseded");
    const recorded = await recordOutcome(input.database, activeLease, {
      status: "available",
    });
    if (!recorded)
      throw new Error("Document processing lease changed before finalization");
  } catch (error) {
    const activeLease = await stopLease();
    if (error instanceof DocumentProcessingError) {
      if (error.removeFromQuarantine && activeLease) {
        const rejected = await recordOutcome(input.database, activeLease, {
          failureCode: error.failureCode,
          status: "rejected",
        });
        if (rejected) {
          const keys = documentObjectKeys(item);
          await input.storage.delete(keys.quarantine).catch(() => undefined);
        }
      }
      // Retryable scanner and storage failures leave the processing lease as
      // the latest event. A future worker may reclaim it after it expires.
      return true;
    }
    throw error;
  }
  return true;
}
