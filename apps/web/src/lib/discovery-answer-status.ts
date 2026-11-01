export function isRequiredAnswerComplete(
  answer: { status: string } | undefined,
) {
  // Required questions must be explicitly addressed, but uncertainty is a
  // supported answer in discovery and is handled conservatively by the rules.
  return ["answered", "unknown", "not_applicable", "deferred"].includes(
    answer?.status ?? "",
  );
}

export function hasAnsweredQuestionValue(type: string, value: unknown) {
  if (type === "multiple_choice" || type === "structured_entities")
    return Array.isArray(value) && value.length > 0;
  if (type === "currency")
    return typeof value === "number" && Number.isFinite(value);
  return typeof value === "string" && value.trim().length > 0;
}
