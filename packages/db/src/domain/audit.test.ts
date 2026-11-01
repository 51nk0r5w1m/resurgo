import { describe, expect, it } from "vitest";

import { buildAuditEvent, verifyAuditEventHash } from "./audit";

describe("audit event integrity", () => {
  it("retains the nonce and detects changes to persisted decision fields", () => {
    const event = buildAuditEvent({
      action: "authorization.case.read",
      actorType: "user",
      actorUserId: "10000000-0000-4000-8000-000000000001",
      outcome: "denied",
      reasonCode: "membership_inactive",
      resourceId: "20000000-0000-4000-8000-000000000002",
      resourceType: "case",
    });

    expect(event.nonce).toMatch(/^[0-9a-f-]{36}$/u);
    expect(verifyAuditEventHash(event)).toBe(true);
    expect(
      verifyAuditEventHash({ ...event, reasonCode: "case_access_denied" }),
    ).toBe(false);
    expect(verifyAuditEventHash({ ...event, resourceType: "document" })).toBe(
      false,
    );
  });
});
