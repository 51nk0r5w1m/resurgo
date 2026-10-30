import { recordAuthorizationDecision } from "../../../../lib/authorization-audit";
import { getAuth, getDatabase } from "../../../../lib/auth";
import { createCaseApi } from "../../../../lib/case-api";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await context.params;
  return createCaseApi({
    database: getDatabase(),
    getSession: (headers) => getAuth().api.getSession({ headers }),
    auditDenied: (decision) =>
      recordAuthorizationDecision(getDatabase(), decision),
  }).read(request, caseId);
}
