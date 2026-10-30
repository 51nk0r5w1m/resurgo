import { createHash, randomUUID } from "node:crypto";

import { auditEvents, type createDatabase } from "@resurgo/db";

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
  const correlationId = input.correlationId ?? randomUUID();
  const eventHash = createHash("sha256")
    .update(
      JSON.stringify({
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        correlationId,
        nonce: randomUUID(),
        outcome: input.outcome,
      }),
    )
    .digest("hex");

  await db.insert(auditEvents).values({
    actorType: input.actorUserId ? "user" : "system",
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: "authentication",
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    correlationId,
    eventHash,
  });
}
