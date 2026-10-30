import { createHash, randomUUID } from "node:crypto";

import { auditEvents, type createDatabase } from "@resurgo/db";

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
  const correlationId = randomUUID();
  const eventHash = createHash("sha256")
    .update(
      JSON.stringify({
        action: input.action,
        actorUserId: input.actorUserId,
        correlationId,
        nonce: randomUUID(),
        outcome: input.outcome,
        resourceId: input.resourceId ?? null,
      }),
    )
    .digest("hex");
  await database.insert(auditEvents).values({
    actorType: "user",
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: "case",
    resourceId: input.resourceId,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    correlationId,
    eventHash,
  });
}
