import {
  authorizeReviewDisclosure,
  AuthorizationDeniedError,
} from "@resurgo/db";
import { z } from "zod";

import { getAuth, getDatabase } from "../../../../../lib/auth";

const bodySchema = z.object({
  professionalReviewId: z.uuid(),
  purpose: z.string().trim().min(3).max(1000),
  recipientCaseMembershipId: z.uuid(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { caseId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(caseId).success || !parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    await authorizeReviewDisclosure(getDatabase(), {
      caseId,
      ...parsed.data,
      userId: session.user.id,
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof AuthorizationDeniedError
            ? "Resource unavailable"
            : "Disclosure could not be updated",
      },
      { status: error instanceof AuthorizationDeniedError ? 404 : 409 },
    );
  }
}
