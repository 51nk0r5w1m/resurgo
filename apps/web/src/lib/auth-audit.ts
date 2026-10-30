import { createHash, randomUUID } from "node:crypto";

import { auditEvents, type createDatabase } from "@resurgo/db";

type Database = ReturnType<typeof createDatabase>["db"];

export async function classifyAuthenticationResponse(response: Response) {
  if (!response.ok) {
    return {
      outcome: "denied" as const,
      reasonCode: `http_${response.status}`,
    };
  }
  const payload = await response
    .clone()
    .json()
    .catch(() => undefined);
  const hasAuthenticationError =
    typeof payload === "object" &&
    payload !== null &&
    (("error" in payload && Boolean(payload.error)) ||
      ("code" in payload &&
        typeof payload.code === "string" &&
        payload.code.length > 0));
  return hasAuthenticationError
    ? { outcome: "denied" as const, reasonCode: "auth_response_error" }
    : { outcome: "success" as const };
}

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
