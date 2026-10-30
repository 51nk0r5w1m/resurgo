export function isRequiredAnswerComplete(
  answer: { status: string } | undefined,
) {
  return answer?.status === "answered";
}
