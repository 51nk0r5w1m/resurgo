import { getAuth, getDatabase } from "../../../lib/auth";
import { createCaseApi } from "../../../lib/case-api";
import { recordAuthorizationDecision } from "../../../lib/authorization-audit";

function api() {
  return createCaseApi({
    database: getDatabase(),
    getSession: (headers) => getAuth().api.getSession({ headers }),
    auditDenied: (decision) =>
      recordAuthorizationDecision(getDatabase(), decision),
  });
}

export async function GET(request: Request) {
  return api().list(request);
}

export async function POST(request: Request) {
  return api().create(request);
}
