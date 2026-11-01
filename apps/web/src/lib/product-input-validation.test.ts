import { describe, expect, test } from "vitest";

import {
  hasAnsweredQuestionValue,
  isQuestionAddressed,
  isRequiredAnswerComplete,
} from "./discovery-answer-status";
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

  test("treats every explicit supported status as addressing a required question", () => {
    expect(isRequiredAnswerComplete({ status: "answered" })).toBe(true);
    expect(isRequiredAnswerComplete({ status: "unknown" })).toBe(true);
    expect(isRequiredAnswerComplete({ status: "deferred" })).toBe(true);
    expect(isRequiredAnswerComplete({ status: "not_applicable" })).toBe(true);
    expect(isRequiredAnswerComplete({ status: "unexpected" })).toBe(false);
    expect(isRequiredAnswerComplete(undefined)).toBe(false);
  });

  test("keeps optional questions in the guided flow until explicitly addressed", () => {
    expect(isQuestionAddressed(undefined, false)).toBe(false);
    expect(isQuestionAddressed({ status: "deferred" }, false)).toBe(true);
    expect(isQuestionAddressed({ status: "unknown" }, true)).toBe(true);
    expect(isQuestionAddressed({ status: "unexpected" }, true)).toBe(false);
  });

  test("rejects empty answered values without native form validation", () => {
    expect(hasAnsweredQuestionValue("single_choice", "")).toBe(false);
    expect(hasAnsweredQuestionValue("single_choice", "yes")).toBe(true);
    expect(hasAnsweredQuestionValue("multiple_choice", [])).toBe(false);
    expect(hasAnsweredQuestionValue("multiple_choice", ["none"])).toBe(true);
    expect(hasAnsweredQuestionValue("structured_entities", [])).toBe(false);
    expect(hasAnsweredQuestionValue("currency", Number.NaN)).toBe(false);
    expect(hasAnsweredQuestionValue("currency", 0)).toBe(true);
  });
});
