import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { and, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
  decideCaseAuthorization,
  hasEffectiveCaseAccess,
  hasEffectiveResourceAccess,
} from "./domain/authorization";
import { createCaseWithOwner } from "./domain/cases";
import {
  grantCaseMembership,
  revokeCaseMembership,
} from "./domain/memberships";
import {
  completeDiscovery,
  getDiscoveryState,
  saveDiscoveryAnswer,
} from "./domain/discovery";
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
      twoFactorEnabled: true,
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

    const persisted = await database
      .select({
        caseId: schema.cases.id,
        membershipStatus: schema.caseMemberships.status,
        membershipUserId: schema.caseMemberships.userId,
      })
      .from(schema.cases)
      .innerJoin(
        schema.caseMemberships,
        and(
          eq(schema.caseMemberships.caseId, schema.cases.id),
          eq(schema.caseMemberships.role, "owner"),
        ),
      )
      .where(eq(schema.cases.id, result.case.id));
    expect(persisted).toEqual([
      {
        caseId: result.case.id,
        membershipStatus: "active",
        membershipUserId: owner.id,
      },
    ]);
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
    await expect(
      hasEffectiveResourceAccess(database, {
        caseId: clientCase.id,
        operation: "view",
        resourceId: resource.id,
        userId: lenderOne.id,
      }),
    ).resolves.toBe(true);

    await database
      .update(schema.cases)
      .set({ status: "paused" })
      .where(eq(schema.cases.id, clientCase.id));
    await expect(
      hasEffectiveCaseAccess(database, {
        caseId: clientCase.id,
        userId: owner.id,
      }),
    ).resolves.toBe(false);
    await expect(
      hasEffectiveResourceAccess(database, {
        caseId: clientCase.id,
        operation: "view",
        resourceId: resource.id,
        userId: lenderOne.id,
      }),
    ).resolves.toBe(false);
    await expect(
      hasEffectiveResourceAccess(database, {
        caseId: clientCase.id,
        operation: "view",
        resourceId: resource.id,
        userId: lenderTwo.id,
      }),
    ).resolves.toBe(false);
  });

  test("invalidates professional access when organization, membership, or consent becomes ineffective", async () => {
    const owner = await createSyntheticUser("lifecycle-owner");
    const professional = await createSyntheticUser("lifecycle-professional");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-FULTON-SUPERIOR", ownerUserId: owner.id },
    );
    const organization = await createVerifiedOrganization(
      "Synthetic Lifecycle Mortgage Provider",
      "lender",
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
        role: "lender",
        status: "active",
        userId: professional.id,
        validFrom: new Date(),
      })
      .returning();
    const [resource] = await database
      .insert(schema.caseResources)
      .values({
        caseId: clientCase.id,
        classification: "financial",
        ownerCaseMembershipId: ownerMembership.id,
        type: "document",
      })
      .returning();
    if (!caseMembership || !resource) {
      throw new Error("Professional access fixture was not created");
    }
    const [consent] = await database
      .insert(schema.disclosureConsents)
      .values({
        caseId: clientCase.id,
        classification: "financial",
        grantorCaseMembershipId: ownerMembership.id,
        operation: "view",
        purpose: "Synthetic lifecycle review",
        recipientCaseMembershipId: caseMembership.id,
        termsHash: "e".repeat(64),
      })
      .returning();
    if (!consent) throw new Error("Consent fixture was not created");
    await database.insert(schema.resourceGrants).values({
      basis: "explicit_consent",
      caseId: clientCase.id,
      classification: "financial",
      granteeCaseMembershipId: caseMembership.id,
      operation: "view",
      resourceId: resource.id,
      sourceConsentId: consent.id,
    });

    const caseDecision = () =>
      hasEffectiveCaseAccess(database, {
        caseId: clientCase.id,
        userId: professional.id,
      });
    const resourceDecision = () =>
      hasEffectiveResourceAccess(database, {
        caseId: clientCase.id,
        operation: "view",
        resourceId: resource.id,
        userId: professional.id,
      });

    await expect(caseDecision()).resolves.toBe(true);
    await expect(resourceDecision()).resolves.toBe(true);

    await database
      .update(schema.organizations)
      .set({ pilotStatus: "suspended" })
      .where(eq(schema.organizations.id, organization.id));
    await expect(caseDecision()).resolves.toBe(false);
    await expect(resourceDecision()).resolves.toBe(false);

    await database
      .update(schema.organizations)
      .set({ pilotStatus: "verified" })
      .where(eq(schema.organizations.id, organization.id));
    await expect(caseDecision()).resolves.toBe(true);

    await database
      .update(schema.disclosureConsents)
      .set({ revokedAt: new Date(), status: "revoked" })
      .where(eq(schema.disclosureConsents.id, consent.id));
    await expect(resourceDecision()).resolves.toBe(false);

    await database
      .update(schema.organizationMemberships)
      .set({ revokedAt: new Date(), status: "revoked" })
      .where(eq(schema.organizationMemberships.id, organizationMembership.id));
    await expect(caseDecision()).resolves.toBe(false);
    await expect(resourceDecision()).resolves.toBe(false);
  });

  test("retains revoked and expired grant history while allowing a new grant", async () => {
    const owner = await createSyntheticUser("regrant-owner");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-DEKALB-SUPERIOR", ownerUserId: owner.id },
    );
    const [resource] = await database
      .insert(schema.caseResources)
      .values({
        caseId: clientCase.id,
        classification: "shared",
        ownerCaseMembershipId: ownerMembership.id,
        type: "roadmap_item",
      })
      .returning();
    if (!resource) throw new Error("Regrant resource fixture was not created");

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const grantValues = {
      basis: "case_owner" as const,
      caseId: clientCase.id,
      classification: "shared" as const,
      granteeCaseMembershipId: ownerMembership.id,
      operation: "view" as const,
      resourceId: resource.id,
    };
    const [revokedGrant] = await database
      .insert(schema.resourceGrants)
      .values({ ...grantValues, effectiveAt: threeHoursAgo })
      .returning();
    if (!revokedGrant) throw new Error("Initial grant was not created");
    await database
      .update(schema.resourceGrants)
      .set({ revokedAt: new Date(), status: "revoked" })
      .where(eq(schema.resourceGrants.id, revokedGrant.id));
    await expect(
      hasEffectiveResourceAccess(database, {
        caseId: clientCase.id,
        operation: "view",
        resourceId: resource.id,
        userId: owner.id,
      }),
    ).resolves.toBe(false);

    const [expiredGrant] = await database
      .insert(schema.resourceGrants)
      .values({ ...grantValues, effectiveAt: twoHoursAgo })
      .returning();
    if (!expiredGrant) throw new Error("Replacement grant was not created");
    await database
      .update(schema.resourceGrants)
      .set({ expiresAt: oneHourAgo, status: "expired" })
      .where(eq(schema.resourceGrants.id, expiredGrant.id));

    await expect(
      hasEffectiveResourceAccess(database, {
        caseId: clientCase.id,
        operation: "view",
        resourceId: resource.id,
        userId: owner.id,
      }),
    ).resolves.toBe(false);

    const [activeGrant] = await database
      .insert(schema.resourceGrants)
      .values(grantValues)
      .returning();
    if (!activeGrant) throw new Error("Renewed grant was not created");
    await expectDatabaseError(
      database.insert(schema.resourceGrants).values(grantValues),
      "23505",
      "resource_grants_active_scope_unique",
    );
    await expect(
      hasEffectiveResourceAccess(database, {
        caseId: clientCase.id,
        operation: "view",
        resourceId: resource.id,
        userId: owner.id,
      }),
    ).resolves.toBe(true);

    const history = await database
      .select({
        id: schema.resourceGrants.id,
        status: schema.resourceGrants.status,
      })
      .from(schema.resourceGrants)
      .where(eq(schema.resourceGrants.resourceId, resource.id));
    expect(history).toEqual(
      expect.arrayContaining([
        { id: revokedGrant.id, status: "revoked" },
        { id: expiredGrant.id, status: "expired" },
        { id: activeGrant.id, status: "active" },
      ]),
    );
    expect(history).toHaveLength(3);
  });

  test("rejects case-owner grant basis for a non-owner membership", async () => {
    const owner = await createSyntheticUser("owner-basis-owner");
    const collaborator = await createSyntheticUser("owner-basis-collaborator");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-FULTON-SUPERIOR", ownerUserId: owner.id },
    );
    const [collaboratorMembership] = await database
      .insert(schema.caseMemberships)
      .values({
        caseId: clientCase.id,
        role: "co_client",
        status: "active",
        userId: collaborator.id,
        validFrom: new Date(),
      })
      .returning();
    const [resource] = await database
      .insert(schema.caseResources)
      .values({
        caseId: clientCase.id,
        classification: "shared",
        ownerCaseMembershipId: ownerMembership.id,
        type: "coordination_note",
      })
      .returning();
    if (!collaboratorMembership || !resource) {
      throw new Error("Owner-basis fixture was not created");
    }

    await expectDatabaseError(
      database.insert(schema.resourceGrants).values({
        basis: "case_owner",
        caseId: clientCase.id,
        classification: "shared",
        granteeCaseMembershipId: collaboratorMembership.id,
        operation: "view",
        resourceId: resource.id,
      }),
      "23514",
    );
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

    await expect(
      hasEffectiveCaseAccess(database, {
        caseId: first.case.id,
        userId: secondOwner.id,
      }),
    ).resolves.toBe(false);
    await expect(
      hasEffectiveResourceAccess(database, {
        caseId: first.case.id,
        operation: "view",
        resourceId: resource.id,
        userId: secondOwner.id,
      }),
    ).resolves.toBe(false);
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

describe("central case authorization", () => {
  test("requires MFA for verified professional case access", async () => {
    const owner = await createSyntheticUser("mfa-policy-owner");
    const professional = await createSyntheticUser("mfa-policy-professional");
    await database
      .update(schema.user)
      .set({ twoFactorEnabled: false })
      .where(eq(schema.user.id, professional.id));
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });
    const organization = await createVerifiedOrganization(
      "Synthetic MFA Policy Law",
      "law_firm",
      owner.id,
    );
    const affiliation = await createProfessionalMembership(
      professional.id,
      organization.id,
    );
    await database.insert(schema.caseMemberships).values({
      caseId: clientCase.id,
      organizationMembershipId: affiliation.id,
      role: "attorney",
      status: "active",
      userId: professional.id,
      validFrom: new Date(),
    });

    await expect(
      decideCaseAuthorization(database, {
        caseId: clientCase.id,
        operation: "read",
        userId: professional.id,
      }),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "professional_mfa_required",
    });

    await database
      .update(schema.user)
      .set({ twoFactorEnabled: true })
      .where(eq(schema.user.id, professional.id));
    await expect(
      decideCaseAuthorization(database, {
        caseId: clientCase.id,
        operation: "read",
        userId: professional.id,
      }),
    ).resolves.toMatchObject({ allowed: true, role: "attorney" });
  });

  test("prevents privilege escalation and revalidates concurrent revocation", async () => {
    const owner = await createSyntheticUser("membership-owner");
    const client = await createSyntheticUser("membership-client");
    const target = await createSyntheticUser("membership-target");
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-DEKALB-SUPERIOR",
      ownerUserId: owner.id,
    });
    const membership = await grantCaseMembership(database, {
      actorUserId: owner.id,
      caseId: clientCase.id,
      role: "co_client",
      userId: client.id,
    });

    await expect(
      grantCaseMembership(database, {
        actorUserId: client.id,
        caseId: clientCase.id,
        role: "co_client",
        userId: target.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });

    await Promise.all([
      decideCaseAuthorization(database, {
        caseId: clientCase.id,
        operation: "read",
        userId: client.id,
      }),
      revokeCaseMembership(database, {
        actorUserId: owner.id,
        caseId: clientCase.id,
        membershipId: membership.id,
      }),
    ]);

    await expect(
      decideCaseAuthorization(database, {
        caseId: clientCase.id,
        operation: "read",
        userId: client.id,
      }),
    ).resolves.toEqual({
      allowed: false,
      reasonCode: "membership_inactive",
    });
  });
});

describe("versioned discovery and roadmap", () => {
  test("rejects cross-case recommendation and roadmap references", async () => {
    const owner = await createSyntheticUser("discovery-reference-owner");
    const first = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });
    const second = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-DEKALB-SUPERIOR",
      ownerUserId: owner.id,
    });

    await expect(
      database.insert(schema.recommendations).values({
        caseId: second.case.id,
        discoverySessionId: first.discoverySession.id,
        explanation: "Synthetic cross-case reference must be rejected.",
        generation: 1,
        ruleVersion: "synthetic-test",
        service: "divorce_attorney",
      }),
    ).rejects.toThrow();

    const [recommendation] = await database
      .insert(schema.recommendations)
      .values({
        caseId: first.case.id,
        discoverySessionId: first.discoverySession.id,
        explanation: "Synthetic same-case recommendation.",
        generation: 1,
        ruleVersion: "synthetic-test",
        service: "divorce_attorney",
      })
      .returning();
    await expect(
      database.insert(schema.roadmapItems).values({
        caseId: second.case.id,
        description: "Synthetic cross-case roadmap reference.",
        generation: 1,
        position: 1,
        recommendationId: recommendation!.id,
        status: "ready",
        title: "Synthetic test item",
      }),
    ).rejects.toThrow();
  });

  test("saves and resumes branching answers then creates a deterministic roadmap", async () => {
    const owner = await createSyntheticUser("discovery-owner");
    const unrelated = await createSyntheticUser("discovery-unrelated");
    const { case: clientCase, discoverySession } = await createCaseWithOwner(
      database,
      {
        jurisdictionCode: "GA-FULTON-SUPERIOR",
        ownerUserId: owner.id,
      },
    );
    await saveDiscoveryAnswer(database, {
      caseId: clientCase.id,
      questionKey: "property_status",
      userId: owner.id,
      value: "solely_owned",
    });
    await saveDiscoveryAnswer(database, {
      caseId: clientCase.id,
      questionKey: "property_status",
      userId: owner.id,
      value: "jointly_owned",
    });
    await saveDiscoveryAnswer(database, {
      caseId: clientCase.id,
      questionKey: "mortgage_status",
      userId: owner.id,
      value: "yes",
    });
    await saveDiscoveryAnswer(database, {
      caseId: clientCase.id,
      questionKey: "financial_complexity",
      userId: owner.id,
      value: "complex",
    });
    await saveDiscoveryAnswer(database, {
      caseId: clientCase.id,
      questionKey: "support_interest",
      userId: owner.id,
      value: "yes",
    });

    const resumed = await getDiscoveryState(database, {
      caseId: clientCase.id,
      userId: owner.id,
    });
    expect(resumed.answers.property_status).toBe("jointly_owned");
    expect(resumed.session.revision).toBe(5);
    expect(
      await database
        .select()
        .from(schema.discoveryAnswers)
        .where(
          and(
            eq(schema.discoveryAnswers.discoverySessionId, discoverySession.id),
            eq(schema.discoveryAnswers.questionKey, "property_status"),
          ),
        ),
    ).toHaveLength(2);
    const answerEvents = await database
      .select({
        action: schema.auditEvents.action,
        correlationId: schema.auditEvents.correlationId,
        reasonCode: schema.auditEvents.reasonCode,
        resourceId: schema.auditEvents.resourceId,
        resourceType: schema.auditEvents.resourceType,
      })
      .from(schema.auditEvents)
      .where(eq(schema.auditEvents.action, "discovery.answer.saved"));
    const serializedEvents = JSON.stringify(answerEvents);
    expect(answerEvents).toHaveLength(5);
    expect(serializedEvents).not.toContain("jointly_owned");
    expect(serializedEvents).not.toContain("complex");

    const completed = await completeDiscovery(database, {
      caseId: clientCase.id,
      userId: owner.id,
    });
    expect(completed.recommendations.map(({ service }) => service)).toEqual([
      "divorce_attorney",
      "mortgage_specialist",
      "financial_specialist",
      "personal_support",
    ]);
    expect(completed.roadmap).toHaveLength(4);
    expect(completed.roadmap[0]?.status).toBe("ready");

    await expect(
      getDiscoveryState(database, {
        caseId: clientCase.id,
        userId: unrelated.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
  });

  test("completes the no-property branch without a mortgage answer", async () => {
    const owner = await createSyntheticUser("no-property-owner");
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-DEKALB-SUPERIOR",
      ownerUserId: owner.id,
    });
    for (const [questionKey, value] of [
      ["property_status", "no_real_property"],
      ["financial_complexity", "straightforward"],
      ["support_interest", "none"],
    ] as const) {
      await saveDiscoveryAnswer(database, {
        caseId: clientCase.id,
        questionKey,
        userId: owner.id,
        value,
      });
    }
    const completed = await completeDiscovery(database, {
      caseId: clientCase.id,
      userId: owner.id,
    });
    expect(completed.recommendations.map(({ service }) => service)).toEqual([
      "divorce_attorney",
    ]);
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
