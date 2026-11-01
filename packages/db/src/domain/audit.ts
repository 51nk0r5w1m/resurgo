import { createHash, randomUUID } from "node:crypto";

type AuditInput = {
  action: string;
  actorType: "system" | "user";
  actorUserId?: string | null;
  caseId?: string | null;
  causationId?: string | null;
  correlationId?: string;
  outcome: "success" | "denied" | "failure";
  previousEventHash?: string | null;
  reasonCode?: string | null;
  resourceId?: string | null;
  resourceType: string;
};

function canonicalAuditPayload(event: {
  action: string;
  actorType: "system" | "user";
  actorUserId: string | null;
  caseId: string | null;
  causationId: string | null;
  correlationId: string;
  id: string;
  nonce: string;
  occurredAt: Date;
  outcome: "success" | "denied" | "failure";
  previousEventHash: string | null;
  reasonCode: string | null;
  resourceId: string | null;
  resourceType: string;
}) {
  return JSON.stringify({
    action: event.action,
    actorType: event.actorType,
    actorUserId: event.actorUserId,
    caseId: event.caseId,
    causationId: event.causationId,
    correlationId: event.correlationId,
    id: event.id,
    nonce: event.nonce,
    occurredAt: event.occurredAt.toISOString(),
    outcome: event.outcome,
    previousEventHash: event.previousEventHash,
    reasonCode: event.reasonCode,
    resourceId: event.resourceId,
    resourceType: event.resourceType,
  });
}

export function buildAuditEvent(input: AuditInput) {
  const event = {
    action: input.action,
    actorType: input.actorType,
    actorUserId: input.actorUserId ?? null,
    caseId: input.caseId ?? null,
    causationId: input.causationId ?? null,
    correlationId: input.correlationId ?? randomUUID(),
    id: randomUUID(),
    nonce: randomUUID(),
    occurredAt: new Date(),
    outcome: input.outcome,
    previousEventHash: input.previousEventHash ?? null,
    reasonCode: input.reasonCode ?? null,
    resourceId: input.resourceId ?? null,
    resourceType: input.resourceType,
  };
  return {
    ...event,
    eventHash: createHash("sha256")
      .update(canonicalAuditPayload(event))
      .digest("hex"),
  };
}

export function verifyAuditEventHash(
  event: ReturnType<typeof buildAuditEvent>,
) {
  return (
    createHash("sha256").update(canonicalAuditPayload(event)).digest("hex") ===
    event.eventHash
  );
}
