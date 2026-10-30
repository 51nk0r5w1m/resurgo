import { AuthorizationDeniedError, revokeCaseMembership } from "@resurgo/db";
import { z } from "zod";

import { recordAuthorizationDecision } from "../../../../../../lib/authorization-audit";
import { getAuth, getDatabase } from "../../../../../../lib/auth";

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{ caseId: string; membershipId: string }>;
  },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { caseId, membershipId } = await context.params;
  if (
    !z.uuid().safeParse(caseId).success ||
    !z.uuid().safeParse(membershipId).success
  ) {
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
  try {
    await revokeCaseMembership(getDatabase(), {
      actorUserId: session.user.id,
      caseId,
      membershipId,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (!(error instanceof AuthorizationDeniedError)) {
      return Response.json(
        { error: "Membership cannot be revoked" },
        { status: 400 },
      );
    }
    await recordAuthorizationDecision(getDatabase(), {
      action: "case.membership.revoke",
      actorUserId: session.user.id,
      outcome: "denied",
      reasonCode: "case_access_denied",
      resourceId: caseId,
    });
    return Response.json({ error: "Resource unavailable" }, { status: 404 });
  }
}
