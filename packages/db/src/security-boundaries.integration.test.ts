import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { and, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { createCaseWithOwner } from "./domain/cases";
import * as schema from "./schema";

const { Client, Pool } = pg;
const sourceUrl = process.env.DATABASE_URL;

if (!sourceUrl) {
  throw new Error("DATABASE_URL is required for database integration tests");
}

const databaseName = `resurgo_integration_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(sourceUrl);
adminUrl.pathname = "/postgres";
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${databaseName}`;

let admin: InstanceType<typeof Client> | undefined;
let pool: InstanceType<typeof Pool> | undefined;
let database!: NodePgDatabase<typeof schema>;

beforeAll(async () => {
  admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);

  pool = new Pool({ connectionString: testUrl.toString() });
  await migrate(drizzle(pool), {
    migrationsFolder: resolve(import.meta.dirname, "../drizzle"),
  });
  database = drizzle(pool, { schema });
}, 30_000);

afterAll(async () => {
  await pool?.end();
  if (admin) {
    await admin.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1",
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    await admin.end();
  }
});

async function createSyntheticUser(label: string) {
  const [created] = await database
    .insert(schema.user)
    .values({
      email: `${label}-${randomUUID()}@synthetic.example`,
      name: `Synthetic ${label}`,
    })
    .returning();

  if (!created) throw new Error("Synthetic user was not created");
  return created;
}

async function expectDatabaseError(
  operation: PromiseLike<unknown>,
  code: string,
  constraint?: string,
) {
  try {
    await operation;
  } catch (error) {
    expect(error).toHaveProperty("cause.code", code);
    if (constraint) {
      expect(error).toHaveProperty("cause.constraint", constraint);
    }
    return;
  }

  throw new Error(`Expected database error ${code}`);
}

async function createProfessionalMembership(
  userId: string,
  organizationId: string,
) {
  const [membership] = await database
    .insert(schema.organizationMemberships)
    .values({
      organizationId,
      role: "professional",
      status: "active",
      userId,
      validFrom: new Date(),
    })
    .returning();

  if (!membership) throw new Error("Organization membership was not created");
  return membership;
}

async function createVerifiedOrganization(
  name: string,
  type: "law_firm" | "lender",
  verifiedByUserId: string,
) {
  const [organization] = await database
    .insert(schema.organizations)
    .values({
      name,
      pilotStatus: "verified",
      slug: `synthetic-${type.replaceAll("_", "-")}-${randomUUID()}`,
      type,
      verifiedAt: new Date(),
      verifiedByUserId,
    })
    .returning();

  if (!organization) throw new Error("Organization was not created");
  return organization;
}

describe("case and professional security boundaries", () => {
  test("creates a case and its active owner membership atomically", async () => {
    const owner = await createSyntheticUser("owner");
    const result = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });

    expect(result.case.ownerUserId).toBe(owner.id);
    expect(result.ownerMembership).toMatchObject({
      caseId: result.case.id,
      organizationMembershipId: null,
      role: "owner",
      status: "active",
      userId: owner.id,
    });
  });

  test("rejects a case that commits without an active owner membership", async () => {
    const owner = await createSyntheticUser("orphan-owner");

    await expectDatabaseError(
      database.insert(schema.cases).values({
        createdByUserId: owner.id,
        jurisdictionCode: "GA-DEKALB-SUPERIOR",
        ownerUserId: owner.id,
      }),
      "23514",
    );
  });

  test("rejects a configured Georgia jurisdiction until it is enabled for the pilot", async () => {
    const owner = await createSyntheticUser("unsupported-court-owner");
    await database.insert(schema.jurisdictions).values({
      code: "GA-COBB-SUPERIOR",
      countyName: "Synthetic Cobb County fixture",
      courtName: "Synthetic Superior Court fixture",
      enabled: false,
      judicialCircuit: "Synthetic circuit fixture",
      reviewedAt: new Date(),
      sourceUrl: "https://synthetic.example/court-source",
      stateCode: "GA",
    });

    await expectDatabaseError(
      createCaseWithOwner(database, {
        jurisdictionCode: "GA-COBB-SUPERIOR",
        ownerUserId: owner.id,
      }),
      "23514",
    );
  });

  test("rejects professional participation from an unverified pilot organization", async () => {
    const owner = await createSyntheticUser("candidate-org-owner");
    const professional = await createSyntheticUser("candidate-professional");
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });
    const [candidateOrganization] = await database
      .insert(schema.organizations)
      .values({
        name: "Synthetic Candidate Mortgage Provider",
        slug: `synthetic-candidate-${randomUUID()}`,
        type: "lender",
      })
      .returning();
    if (!candidateOrganization) throw new Error("Organization was not created");
    const candidateMembership = await createProfessionalMembership(
      professional.id,
      candidateOrganization.id,
    );

    await expectDatabaseError(
      database.insert(schema.caseMemberships).values({
        caseId: clientCase.id,
        organizationMembershipId: candidateMembership.id,
        role: "lender",
        status: "active",
        userId: professional.id,
        validFrom: new Date(),
      }),
      "23514",
    );
  });

  test("does not let organization affiliation inherit another professional's grant", async () => {
    const owner = await createSyntheticUser("sharing-owner");
    const lenderOne = await createSyntheticUser("lender-one");
    const lenderTwo = await createSyntheticUser("lender-two");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-FULTON-SUPERIOR", ownerUserId: owner.id },
    );

    const organization = await createVerifiedOrganization(
      "Synthetic Peach Lending",
      "lender",
      owner.id,
    );

    const lenderOneOrganizationMembership = await createProfessionalMembership(
      lenderOne.id,
      organization.id,
    );
    const lenderTwoOrganizationMembership = await createProfessionalMembership(
      lenderTwo.id,
      organization.id,
    );

    const [lenderOneCaseMembership, lenderTwoCaseMembership] = await database
      .insert(schema.caseMemberships)
      .values([
        {
          caseId: clientCase.id,
          organizationMembershipId: lenderOneOrganizationMembership.id,
          role: "lender" as const,
          status: "active" as const,
          userId: lenderOne.id,
          validFrom: new Date(),
        },
        {
          caseId: clientCase.id,
          organizationMembershipId: lenderTwoOrganizationMembership.id,
          role: "lender" as const,
          status: "active" as const,
          userId: lenderTwo.id,
          validFrom: new Date(),
        },
      ])
      .returning();
    if (!lenderOneCaseMembership || !lenderTwoCaseMembership) {
      throw new Error("Case memberships were not created");
    }

    const [resource] = await database
      .insert(schema.caseResources)
      .values({
        caseId: clientCase.id,
        classification: "financial",
        ownerCaseMembershipId: ownerMembership.id,
        type: "document",
      })
      .returning();
    if (!resource) throw new Error("Resource was not created");

    const [consent] = await database
      .insert(schema.disclosureConsents)
      .values({
        caseId: clientCase.id,
        classification: "financial",
        grantorCaseMembershipId: ownerMembership.id,
        operation: "view",
        purpose: "Synthetic mortgage-readiness review",
        recipientCaseMembershipId: lenderOneCaseMembership.id,
        termsHash: "a".repeat(64),
      })
      .returning();
    if (!consent) throw new Error("Consent was not created");

    await database.insert(schema.resourceGrants).values({
      basis: "explicit_consent",
      caseId: clientCase.id,
      classification: "financial",
      granteeCaseMembershipId: lenderOneCaseMembership.id,
      operation: "view",
      resourceId: resource.id,
      sourceConsentId: consent.id,
    });

    const lenderOneGrants = await database
      .select({ resourceId: schema.resourceGrants.resourceId })
      .from(schema.resourceGrants)
      .where(
        and(
          eq(
            schema.resourceGrants.granteeCaseMembershipId,
            lenderOneCaseMembership.id,
          ),
          eq(schema.resourceGrants.status, "active"),
        ),
      );
    const lenderTwoGrants = await database
      .select({ resourceId: schema.resourceGrants.resourceId })
      .from(schema.resourceGrants)
      .where(
        eq(
          schema.resourceGrants.granteeCaseMembershipId,
          lenderTwoCaseMembership.id,
        ),
      );

    expect(lenderOneGrants).toEqual([{ resourceId: resource.id }]);
    expect(lenderTwoGrants).toEqual([]);
  });

  test("rejects cross-case resource and consent references", async () => {
    const firstOwner = await createSyntheticUser("first-case-owner");
    const secondOwner = await createSyntheticUser("second-case-owner");
    const first = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: firstOwner.id,
    });
    const second = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-DEKALB-SUPERIOR",
      ownerUserId: secondOwner.id,
    });
    const [resource] = await database
      .insert(schema.caseResources)
      .values({
        caseId: first.case.id,
        classification: "legal",
        ownerCaseMembershipId: first.ownerMembership.id,
        type: "document",
      })
      .returning();
    if (!resource) throw new Error("Resource was not created");

    await expectDatabaseError(
      database.insert(schema.resourceGrants).values({
        basis: "case_owner",
        caseId: second.case.id,
        classification: "legal",
        granteeCaseMembershipId: second.ownerMembership.id,
        operation: "view",
        resourceId: resource.id,
      }),
      "23503",
      "resource_grants_resource_classification_fk",
    );

    await expectDatabaseError(
      database.insert(schema.disclosureConsents).values({
        caseId: first.case.id,
        classification: "legal",
        grantorCaseMembershipId: first.ownerMembership.id,
        operation: "view",
        purpose: "Synthetic cross-case attempt",
        recipientCaseMembershipId: second.ownerMembership.id,
        termsHash: "b".repeat(64),
      }),
      "23503",
      "disclosure_consents_recipient_membership_fk",
    );
  });

  test("requires consent scope to match the grantee, classification, and operation", async () => {
    const owner = await createSyntheticUser("consent-owner");
    const professional = await createSyntheticUser("consent-professional");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-FULTON-SUPERIOR", ownerUserId: owner.id },
    );
    const organization = await createVerifiedOrganization(
      "Synthetic Peachtree Family Law",
      "law_firm",
      owner.id,
    );
    const organizationMembership = await createProfessionalMembership(
      professional.id,
      organization.id,
    );
    const [caseMembership] = await database
      .insert(schema.caseMemberships)
      .values({
        caseId: clientCase.id,
        organizationMembershipId: organizationMembership.id,
        role: "attorney",
        status: "active",
        userId: professional.id,
        validFrom: new Date(),
      })
      .returning();
    const [resource] = await database
      .insert(schema.caseResources)
      .values({
        caseId: clientCase.id,
        classification: "legal",
        ownerCaseMembershipId: ownerMembership.id,
        type: "document",
      })
      .returning();
    if (!caseMembership || !resource)
      throw new Error("Fixture was not created");

    await expectDatabaseError(
      database.insert(schema.resourceGrants).values({
        basis: "explicit_consent",
        caseId: clientCase.id,
        classification: "legal",
        granteeCaseMembershipId: caseMembership.id,
        operation: "view",
        resourceId: resource.id,
      }),
      "23514",
      "resource_grants_basis_consent_check",
    );

    const [downloadConsent] = await database
      .insert(schema.disclosureConsents)
      .values({
        caseId: clientCase.id,
        classification: "legal",
        grantorCaseMembershipId: ownerMembership.id,
        operation: "download",
        purpose: "Synthetic legal review",
        recipientCaseMembershipId: caseMembership.id,
        termsHash: "c".repeat(64),
      })
      .returning();
    if (!downloadConsent) throw new Error("Consent was not created");

    await expectDatabaseError(
      database.insert(schema.resourceGrants).values({
        basis: "explicit_consent",
        caseId: clientCase.id,
        classification: "legal",
        granteeCaseMembershipId: caseMembership.id,
        operation: "view",
        resourceId: resource.id,
        sourceConsentId: downloadConsent.id,
      }),
      "23503",
      "resource_grants_source_consent_scope_fk",
    );
  });
});

describe("audit-event integrity", () => {
  test("allows inserts but rejects updates and deletes", async () => {
    const [event] = await database
      .insert(schema.auditEvents)
      .values({
        action: "security.synthetic_test",
        actorType: "system",
        correlationId: randomUUID(),
        eventHash: "d".repeat(64),
        outcome: "success",
        resourceType: "test_fixture",
      })
      .returning();
    if (!event) throw new Error("Audit event was not created");

    await expectDatabaseError(
      database
        .update(schema.auditEvents)
        .set({ reasonCode: "mutation-attempt" })
        .where(eq(schema.auditEvents.id, event.id)),
      "55000",
    );

    await expectDatabaseError(
      database
        .delete(schema.auditEvents)
        .where(eq(schema.auditEvents.id, event.id)),
      "55000",
    );
  });
});
