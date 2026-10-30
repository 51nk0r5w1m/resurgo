import {
  AuthorizationDeniedError,
  createCaseWithOwner,
  getAuthorizedCase,
  listAccessibleCases,
  type createDatabase,
} from "@resurgo/db";
import { z } from "zod";

type Database = ReturnType<typeof createDatabase>["db"];
type Session = { user: { id: string } } | null;

const createCaseRequest = z.object({
  jurisdictionCode: z.enum(["GA-FULTON-SUPERIOR", "GA-DEKALB-SUPERIOR"]),
});
const identifier = z.uuid();

export function createCaseApi(input: {
  auditDenied: (decision: {
    action: string;
    actorUserId: string;
    outcome: "denied";
    reasonCode: string;
    resourceId: string;
  }) => Promise<void>;
  database: Database;
  getSession: (headers: Headers) => Promise<Session>;
}) {
  return {
    async list(request: Request) {
      const session = await input.getSession(request.headers);
      if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const cases = await listAccessibleCases(input.database, session.user.id);
      return Response.json(
        { cases },
        { headers: { "cache-control": "no-store" } },
      );
    },

    async create(request: Request) {
      const session = await input.getSession(request.headers);
      if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const parsed = createCaseRequest.safeParse(
        await request.json().catch(() => null),
      );
      if (!parsed.success) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }
      const result = await createCaseWithOwner(input.database, {
        jurisdictionCode: parsed.data.jurisdictionCode,
        ownerUserId: session.user.id,
      });
      return Response.json(
        {
          case: {
            id: result.case.id,
            jurisdictionCode: result.case.jurisdictionCode,
            status: result.case.status,
          },
        },
        { status: 201, headers: { "cache-control": "no-store" } },
      );
    },

    async read(request: Request, caseId: string) {
      const session = await input.getSession(request.headers);
      if (!session) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!identifier.safeParse(caseId).success) {
        return Response.json(
          { error: "Resource unavailable" },
          { status: 404 },
        );
      }
      try {
        const caseRecord = await getAuthorizedCase(input.database, {
          caseId,
          userId: session.user.id,
        });
        if (!caseRecord) throw new AuthorizationDeniedError();
        return Response.json(
          { case: caseRecord },
          { headers: { "cache-control": "no-store" } },
        );
      } catch (error) {
        if (!(error instanceof AuthorizationDeniedError)) throw error;
        await input.auditDenied({
          action: "case.read",
          actorUserId: session.user.id,
          outcome: "denied",
          reasonCode: "case_access_denied",
          resourceId: caseId,
        });
        return Response.json(
          { error: "Resource unavailable" },
          { status: 404 },
        );
      }
    },
  };
}
