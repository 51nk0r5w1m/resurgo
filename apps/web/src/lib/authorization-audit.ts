import { auditEvents, buildAuditEvent, type createDatabase } from "@resurgo/db";

type Database = ReturnType<typeof createDatabase>["db"];

export async function recordAuthorizationDecision(
  database: Database,
  input: {
    action: string;
    actorUserId: string;
    resourceId?: string;
    outcome: "success" | "denied";
    reasonCode?: string;
  },
) {
  await database.insert(auditEvents).values(
    buildAuditEvent({
      actorType: "user",
      resourceType: "case",
      ...input,
    }),
  );
}
