import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import * as schema from "../schema";
import { caseMemberships, cases } from "../schema";

export interface CreateCaseWithOwnerInput {
  jurisdictionCode: string;
  ownerUserId: string;
}

export async function createCaseWithOwner(
  database: NodePgDatabase<typeof schema>,
  input: CreateCaseWithOwnerInput,
) {
  return database.transaction(async (transaction) => {
    const [createdCase] = await transaction
      .insert(cases)
      .values({
        createdByUserId: input.ownerUserId,
        jurisdictionCode: input.jurisdictionCode,
        ownerUserId: input.ownerUserId,
      })
      .returning();

    if (!createdCase) {
      throw new Error("Case creation did not return a record");
    }

    const [ownerMembership] = await transaction
      .insert(caseMemberships)
      .values({
        caseId: createdCase.id,
        role: "owner",
        status: "active",
        userId: input.ownerUserId,
        validFrom: createdCase.createdAt,
      })
      .returning();

    if (!ownerMembership) {
      throw new Error("Owner membership creation did not return a record");
    }

    return { case: createdCase, ownerMembership };
  });
}
