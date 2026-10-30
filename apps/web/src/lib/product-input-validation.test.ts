import { describe, expect, test } from "vitest";

import { isRequiredAnswerComplete } from "./discovery-answer-status";
import { isAcceptedDocumentFile } from "./document-file-validation";

describe("client-side product input validation", () => {
  test("requires both a supported extension and a compatible MIME type", () => {
    expect(
      isAcceptedDocumentFile({
        name: "statement.pdf",
        type: "application/pdf",
      }),
    ).toBe(true);
    expect(isAcceptedDocumentFile({ name: "statement.docx", type: "" })).toBe(
      true,
    );
    expect(
      isAcceptedDocumentFile({ name: "renamed.pdf", type: "text/html" }),
    ).toBe(false);
    expect(
      isAcceptedDocumentFile({ name: "renamed.exe", type: "application/pdf" }),
    ).toBe(false);
  });

  test("does not treat unknown, deferred, or inapplicable facts as answered", () => {
    expect(isRequiredAnswerComplete({ status: "answered" })).toBe(true);
    expect(isRequiredAnswerComplete({ status: "unknown" })).toBe(false);
    expect(isRequiredAnswerComplete({ status: "deferred" })).toBe(false);
    expect(isRequiredAnswerComplete({ status: "not_applicable" })).toBe(false);
    expect(isRequiredAnswerComplete(undefined)).toBe(false);
  });
});
