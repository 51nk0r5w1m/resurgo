import { auditEvents, buildAuditEvent, type createDatabase } from "@resurgo/db";

type Database = ReturnType<typeof createDatabase>["db"];

export async function recordAuthEvent(
  db: Database,
  input: {
    action: string;
    actorUserId?: string;
    outcome: "success" | "denied" | "failure";
    reasonCode?: string;
    correlationId?: string;
  },
) {
  await db.insert(auditEvents).values(
    buildAuditEvent({
      ...input,
      actorType: input.actorUserId ? "user" : "system",
      resourceType: "authentication",
    }),
  );
}
