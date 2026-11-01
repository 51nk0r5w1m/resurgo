import { describe, expect, it } from "vitest";

import { documentObjectKeys } from "./keys";

describe("document object keys", () => {
  it("accepts opaque UUID identifiers", () => {
    expect(
      documentObjectKeys({
        caseId: "10000000-0000-4000-8000-000000000001",
        documentId: "20000000-0000-4000-8000-000000000002",
        versionId: "30000000-0000-4000-8000-000000000003",
      }).quarantine,
    ).toBe(
      "quarantine/10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/30000000-0000-4000-8000-000000000003/source",
    );
  });

  it.each([
    "100000000000-4000-8000-000000000001",
    "10000000--000-4000-8000-000000000001",
    "10000000-0000-4000-8000-00000000000g",
    "../../another-case",
  ])("rejects malformed identifier %s", (caseId) => {
    expect(() =>
      documentObjectKeys({
        caseId,
        documentId: "20000000-0000-4000-8000-000000000002",
        versionId: "30000000-0000-4000-8000-000000000003",
      }),
    ).toThrow("Invalid opaque document identifier");
  });
});
