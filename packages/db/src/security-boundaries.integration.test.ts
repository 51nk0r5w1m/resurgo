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
  createDocumentRequest,
  listAuthorizedDocumentRequests,
  transitionDocumentRequest,
} from "./domain/document-requests";
import {
  addDocumentVersion,
  createDocumentWithVersion,
  getAuthorizedAvailableDocumentVersion,
  grantDocumentAccess,
  listAuthorizedDocuments,
  recordDocumentLegalHold,
  recordDocumentProcessingEvent,
} from "./domain/documents";
import {
  grantCaseMembership,
  revokeCaseMembership,
} from "./domain/memberships";
import {
  completeDiscovery,
  getDiscoveryState,
  saveDiscoveryAnswer,
} from "./domain/discovery";
import {
  appendProfessionalReviewRevision,
  computeProfessionalReviewStatementHash,
  createProfessionalReview,
  grantProfessionalReviewAccess,
  listAuthorizedProfessionalReviews,
  recordAttorneyReviewAcknowledgement,
} from "./domain/reviews";
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
  test("rejects duplicate memberships for the same user and case", async () => {
    const owner = await createSyntheticUser("duplicate-membership-owner");
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });

    await expectDatabaseError(
      database.insert(schema.caseMemberships).values({
        caseId: clientCase.id,
        role: "co_client",
        status: "active",
        userId: owner.id,
        validFrom: new Date(),
      }),
      "23505",
      "case_memberships_case_user_unique",
    );
  });

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

describe("immutable document and professional review foundations", () => {
  test("enforces consent-scoped document requests and immutable request history", async () => {
    const owner = await createSyntheticUser("request-owner");
    const professional = await createSyntheticUser("request-professional");
    const unrelated = await createSyntheticUser("request-unrelated");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-FULTON-SUPERIOR", ownerUserId: owner.id },
    );
    const organization = await createVerifiedOrganization(
      "Synthetic Request Mortgage Pilot",
      "lender",
      owner.id,
    );
    const affiliation = await createProfessionalMembership(
      professional.id,
      organization.id,
    );
    const [professionalMembership] = await database
      .insert(schema.caseMemberships)
      .values({
        caseId: clientCase.id,
        organizationMembershipId: affiliation.id,
        role: "lender",
        status: "active",
        userId: professional.id,
        validFrom: new Date(),
      })
      .returning();
    if (!professionalMembership) throw new Error("Membership was not created");
    const consents = await database
      .insert(schema.disclosureConsents)
      .values(
        (["view", "contribute"] as const).map((operation) => ({
          caseId: clientCase.id,
          classification: "financial" as const,
          grantorCaseMembershipId: ownerMembership.id,
          operation,
          purpose: "Synthetic document request coordination",
          recipientCaseMembershipId: professionalMembership.id,
          termsHash: operation === "view" ? "7".repeat(64) : "8".repeat(64),
        })),
      )
      .returning();
    const viewConsent = consents.find(({ operation }) => operation === "view");
    const contributeConsent = consents.find(
      ({ operation }) => operation === "contribute",
    );
    if (!viewConsent || !contributeConsent) throw new Error("Consents missing");

    const request = await createDocumentRequest(database, {
      assignedToCaseMembershipId: professionalMembership.id,
      assigneeConsentIds: {
        contribute: contributeConsent.id,
        view: viewConsent.id,
      },
      caseId: clientCase.id,
      classification: "financial",
      description: "Provide the synthetic payoff statement for review.",
      title: "Synthetic payoff statement",
      userId: owner.id,
    });
    await expect(
      listAuthorizedDocumentRequests(database, {
        caseId: clientCase.id,
        userId: professional.id,
      }),
    ).resolves.toHaveLength(1);
    await database
      .update(schema.disclosureConsents)
      .set({ revokedAt: new Date(), status: "revoked" })
      .where(eq(schema.disclosureConsents.id, viewConsent.id));
    await expect(
      listAuthorizedDocumentRequests(database, {
        caseId: clientCase.id,
        userId: professional.id,
      }),
    ).resolves.toEqual([]);
    await database
      .update(schema.disclosureConsents)
      .set({ revokedAt: new Date(), status: "revoked" })
      .where(eq(schema.disclosureConsents.id, contributeConsent.id));
    await expect(
      transitionDocumentRequest(database, {
        caseId: clientCase.id,
        documentRequestId: request.id,
        status: "cancelled",
        userId: professional.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    await expect(
      listAuthorizedDocumentRequests(database, {
        caseId: clientCase.id,
        userId: unrelated.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    const [event] = await database
      .select({ id: schema.documentRequestEvents.id })
      .from(schema.documentRequestEvents)
      .where(eq(schema.documentRequestEvents.documentRequestId, request.id))
      .limit(1);
    await expectDatabaseError(
      database
        .update(schema.documentRequestEvents)
        .set({ status: "cancelled" })
        .where(eq(schema.documentRequestEvents.id, event!.id)),
      "55000",
    );
  });

  test("tracks an exact available version through request submission and completion", async () => {
    const owner = await createSyntheticUser("request-lifecycle-owner");
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-DEKALB-SUPERIOR",
      ownerUserId: owner.id,
    });
    const request = await createDocumentRequest(database, {
      caseId: clientCase.id,
      classification: "legal",
      description: "Upload the synthetic court filing for the case record.",
      title: "Synthetic filed petition",
      userId: owner.id,
    });
    const document = await createDocumentWithVersion(database, {
      byteSize: 640,
      caseId: clientCase.id,
      classification: "legal",
      confidentiality: "confidential",
      contentHash: "9".repeat(64),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "synthetic_request_record",
      source: "client_upload",
      title: "Synthetic filed petition",
      userId: owner.id,
    });
    await database.insert(schema.documentProcessingEvents).values({
      caseId: clientCase.id,
      documentId: document.document.id,
      documentVersionId: document.version.id,
      status: "available",
    });
    const wrongDomainDocument = await createDocumentWithVersion(database, {
      byteSize: 650,
      caseId: clientCase.id,
      classification: "financial",
      confidentiality: "financial_restricted",
      contentHash: "0".repeat(64),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "synthetic_request_record",
      source: "client_upload",
      title: "Synthetic financial record",
      userId: owner.id,
    });
    await database.insert(schema.documentProcessingEvents).values({
      caseId: clientCase.id,
      documentId: wrongDomainDocument.document.id,
      documentVersionId: wrongDomainDocument.version.id,
      status: "available",
    });
    await expect(
      transitionDocumentRequest(database, {
        caseId: clientCase.id,
        documentId: wrongDomainDocument.document.id,
        documentRequestId: request.id,
        documentVersionId: wrongDomainDocument.version.id,
        status: "submitted",
        userId: owner.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    await transitionDocumentRequest(database, {
      caseId: clientCase.id,
      documentId: document.document.id,
      documentRequestId: request.id,
      documentVersionId: document.version.id,
      status: "submitted",
      userId: owner.id,
    });
    await transitionDocumentRequest(database, {
      caseId: clientCase.id,
      documentId: document.document.id,
      documentRequestId: request.id,
      documentVersionId: document.version.id,
      status: "completed",
      userId: owner.id,
    });
    await expect(
      listAuthorizedDocumentRequests(database, {
        caseId: clientCase.id,
        userId: owner.id,
      }),
    ).resolves.toMatchObject([
      {
        document_id: document.document.id,
        document_version_id: document.version.id,
        status: "completed",
      },
    ]);
  });

  test("records clarification, specialist findings, and consent-bound attorney acknowledgement", async () => {
    const owner = await createSyntheticUser("review-register-owner");
    const specialist = await createSyntheticUser("review-register-lender");
    const attorney = await createSyntheticUser("review-register-attorney");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-FULTON-SUPERIOR", ownerUserId: owner.id },
    );
    const lenderOrganization = await createVerifiedOrganization(
      "Synthetic Review Lender",
      "lender",
      owner.id,
    );
    const lawFirm = await createVerifiedOrganization(
      "Synthetic Review Law Firm",
      "law_firm",
      owner.id,
    );
    const lenderAffiliation = await createProfessionalMembership(
      specialist.id,
      lenderOrganization.id,
    );
    const attorneyAffiliation = await createProfessionalMembership(
      attorney.id,
      lawFirm.id,
    );
    const memberships = await database
      .insert(schema.caseMemberships)
      .values([
        {
          caseId: clientCase.id,
          organizationMembershipId: lenderAffiliation.id,
          role: "lender" as const,
          status: "active" as const,
          userId: specialist.id,
          validFrom: new Date(),
        },
        {
          caseId: clientCase.id,
          organizationMembershipId: attorneyAffiliation.id,
          role: "attorney" as const,
          status: "active" as const,
          userId: attorney.id,
          validFrom: new Date(),
        },
      ])
      .returning();
    const lenderMembership = memberships.find(({ role }) => role === "lender");
    const attorneyMembership = memberships.find(
      ({ role }) => role === "attorney",
    );
    if (!lenderMembership || !attorneyMembership) {
      throw new Error("Professional memberships were not created");
    }
    const document = await createDocumentWithVersion(database, {
      byteSize: 840,
      caseId: clientCase.id,
      classification: "financial",
      confidentiality: "financial_restricted",
      contentHash: "b".repeat(64),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "synthetic_review_record",
      source: "client_upload",
      title: "Synthetic mortgage statement",
      userId: owner.id,
    });
    await database.insert(schema.documentProcessingEvents).values({
      caseId: clientCase.id,
      documentId: document.document.id,
      documentVersionId: document.version.id,
      status: "available",
    });
    const consentExpiry = new Date(Date.now() + 60 * 60 * 1000);
    const lenderConsents = await database
      .insert(schema.disclosureConsents)
      .values(
        (["view", "contribute"] as const).map((operation) => ({
          caseId: clientCase.id,
          classification: "financial" as const,
          expiresAt: consentExpiry,
          grantorCaseMembershipId: ownerMembership.id,
          operation,
          purpose: "Synthetic mortgage specialist review",
          recipientCaseMembershipId: lenderMembership.id,
          termsHash: operation === "view" ? "c".repeat(64) : "d".repeat(64),
        })),
      )
      .returning();
    const lenderView = lenderConsents.find(
      ({ operation }) => operation === "view",
    );
    const lenderContribute = lenderConsents.find(
      ({ operation }) => operation === "contribute",
    );
    if (!lenderView || !lenderContribute) throw new Error("Consents missing");
    const documentGrants = await grantDocumentAccess(database, {
      caseId: clientCase.id,
      documentId: document.document.id,
      granteeCaseMembershipId: lenderMembership.id,
      grants: [
        { operation: "view", sourceConsentId: lenderView.id },
        { operation: "contribute", sourceConsentId: lenderContribute.id },
      ],
      userId: owner.id,
    });
    expect(documentGrants).toHaveLength(2);
    expect(
      documentGrants.every(
        ({ expiresAt }) => expiresAt?.getTime() === consentExpiry.getTime(),
      ),
    ).toBe(true);
    const review = await createProfessionalReview(database, {
      caseId: clientCase.id,
      classification: "financial",
      decisionContext: "Coordinate the synthetic mortgage transition.",
      evidence: [
        {
          documentId: document.document.id,
          documentVersionId: document.version.id,
          purpose: "Review the synthetic balance and payment record.",
        },
      ],
      responsibleCaseMembershipId: lenderMembership.id,
      responsibleGrantConsents: {
        contributeConsentId: lenderContribute.id,
        viewConsentId: lenderView.id,
      },
      reviewScope: "Identify factual mortgage conditions for attorney review.",
      subjectType: "mortgage_property",
      userId: owner.id,
    });
    await appendProfessionalReviewRevision(database, {
      caseId: clientCase.id,
      decisionContext: "Synthetic specialist review is underway.",
      evidence: [
        {
          documentId: document.document.id,
          documentVersionId: document.version.id,
          purpose: "Current synthetic evidence under review.",
        },
      ],
      professionalReviewId: review.review.id,
      reviewScope: "Review factual mortgage information.",
      status: "in_progress",
      userId: specialist.id,
    });
    await appendProfessionalReviewRevision(database, {
      caseId: clientCase.id,
      decisionContext: "Additional synthetic payoff evidence is required.",
      evidence: [
        {
          documentId: document.document.id,
          documentVersionId: document.version.id,
          purpose: "Current synthetic evidence under review.",
        },
      ],
      professionalReviewId: review.review.id,
      reviewScope: "Clarify the current synthetic payoff amount.",
      statements: [
        {
          body: "Please provide a current synthetic payoff statement.",
          type: "clarification_request",
        },
      ],
      status: "clarification_required",
      userId: specialist.id,
    });
    const completed = await appendProfessionalReviewRevision(database, {
      caseId: clientCase.id,
      decisionContext: "Synthetic specialist review completed.",
      evidence: [
        {
          documentId: document.document.id,
          documentVersionId: document.version.id,
          purpose: "Evidence supporting the synthetic factual finding.",
        },
      ],
      professionalReviewId: review.review.id,
      reviewScope: "Record factual findings without an eligibility decision.",
      statements: [
        {
          body: "Qualified professional review remains required for any decision.",
          type: "finding",
        },
      ],
      status: "completed",
      userId: specialist.id,
    });
    const [attorneyConsent] = await database
      .insert(schema.disclosureConsents)
      .values({
        caseId: clientCase.id,
        classification: "financial",
        grantorCaseMembershipId: ownerMembership.id,
        operation: "view",
        purpose: "Attorney acknowledgement of specialist findings",
        recipientCaseMembershipId: attorneyMembership.id,
        termsHash: "e".repeat(64),
      })
      .returning();
    if (!attorneyConsent) throw new Error("Attorney consent missing");
    await grantProfessionalReviewAccess(database, {
      caseId: clientCase.id,
      consentId: attorneyConsent.id,
      granteeCaseMembershipId: attorneyMembership.id,
      operation: "view",
      professionalReviewId: review.review.id,
      userId: owner.id,
    });
    await expect(
      recordAttorneyReviewAcknowledgement(database, {
        action: "acknowledged",
        caseId: clientCase.id,
        professionalReviewId: review.review.id,
        reviewRevisionId: completed.id,
        statementHash: "f".repeat(64),
        userId: attorney.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    await recordAttorneyReviewAcknowledgement(database, {
      action: "acknowledged",
      caseId: clientCase.id,
      professionalReviewId: review.review.id,
      reviewRevisionId: completed.id,
      statementHash: computeProfessionalReviewStatementHash({
        decisionContext: "Synthetic specialist review completed.",
        reviewScope: "Record factual findings without an eligibility decision.",
        statements: [
          {
            body: "Qualified professional review remains required for any decision.",
            type: "finding",
          },
        ],
      }),
      userId: attorney.id,
    });
    await expectDatabaseError(
      database.insert(schema.professionalReviewRevisions).values({
        caseId: clientCase.id,
        createdByCaseMembershipId: ownerMembership.id,
        decisionContext: "Synthetic invalid lineage",
        professionalReviewId: review.review.id,
        reviewScope: "This revision skips its immediate predecessor.",
        revision: 99,
        status: "superseded",
        supersedesRevisionId: completed.id,
      }),
      "23514",
    );
    await expectDatabaseError(
      database.insert(schema.professionalReviewAcknowledgements).values({
        action: "acknowledged",
        attorneyCaseMembershipId: ownerMembership.id,
        caseId: clientCase.id,
        professionalReviewId: review.review.id,
        reviewRevisionId: completed.id,
        statementHash: "a".repeat(64),
      }),
      "23514",
    );
    await expect(
      listAuthorizedProfessionalReviews(database, {
        caseId: clientCase.id,
        userId: attorney.id,
      }),
    ).resolves.toMatchObject([
      {
        professionalReviewId: review.review.id,
        status: "completed",
      },
    ]);
    await database
      .update(schema.disclosureConsents)
      .set({ revokedAt: new Date(), status: "revoked" })
      .where(eq(schema.disclosureConsents.id, attorneyConsent.id));
    await expect(
      listAuthorizedProfessionalReviews(database, {
        caseId: clientCase.id,
        userId: attorney.id,
      }),
    ).resolves.toEqual([]);
    expect(
      await database
        .select()
        .from(schema.professionalReviewAcknowledgements)
        .where(
          eq(
            schema.professionalReviewAcknowledgements.reviewRevisionId,
            completed.id,
          ),
        ),
    ).toHaveLength(1);
  });

  test("never exposes quarantined versions or cross-case document metadata", async () => {
    const owner = await createSyntheticUser("document-boundary-owner");
    const unrelated = await createSyntheticUser("document-boundary-unrelated");
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });
    const created = await createDocumentWithVersion(database, {
      byteSize: 512,
      caseId: clientCase.id,
      classification: "financial",
      confidentiality: "financial_restricted",
      contentHash: "6".repeat(64),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "synthetic_pilot_record",
      source: "client_upload",
      title: "Synthetic property transition statement",
      userId: owner.id,
    });

    await expect(
      getAuthorizedAvailableDocumentVersion(database, {
        caseId: clientCase.id,
        documentId: created.document.id,
        operation: "view",
        userId: owner.id,
        versionId: created.version.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });

    await database.insert(schema.documentProcessingEvents).values({
      caseId: clientCase.id,
      documentId: created.document.id,
      documentVersionId: created.version.id,
      status: "available",
    });
    await expect(
      getAuthorizedAvailableDocumentVersion(database, {
        caseId: clientCase.id,
        documentId: created.document.id,
        operation: "view",
        userId: owner.id,
        versionId: created.version.id,
      }),
    ).resolves.toMatchObject({
      documentId: created.document.id,
      versionId: created.version.id,
    });
    await expect(
      listAuthorizedDocuments(database, {
        caseId: clientCase.id,
        userId: unrelated.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    await expect(
      getAuthorizedAvailableDocumentVersion(database, {
        caseId: clientCase.id,
        documentId: created.document.id,
        operation: "download",
        userId: unrelated.id,
        versionId: created.version.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
  });

  test("rejects terminal processing regressions and serializes legal holds", async () => {
    const owner = await createSyntheticUser("document-lifecycle-owner");
    const { case: clientCase } = await createCaseWithOwner(database, {
      jurisdictionCode: "GA-FULTON-SUPERIOR",
      ownerUserId: owner.id,
    });
    const created = await createDocumentWithVersion(database, {
      byteSize: 256,
      caseId: clientCase.id,
      classification: "legal",
      confidentiality: "confidential",
      contentHash: "9".repeat(64),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "synthetic_lifecycle_record",
      source: "client_upload",
      title: "Synthetic lifecycle document",
      userId: owner.id,
    });

    await database.insert(schema.documentProcessingEvents).values({
      caseId: clientCase.id,
      documentId: created.document.id,
      documentVersionId: created.version.id,
      status: "available",
    });
    await expect(
      recordDocumentProcessingEvent(database, {
        caseId: clientCase.id,
        documentId: created.document.id,
        failureCode: "synthetic_late_failure",
        status: "rejected",
        userId: owner.id,
        versionId: created.version.id,
      }),
    ).rejects.toThrow("Invalid document processing status transition");

    const holdResults = await Promise.allSettled([
      recordDocumentLegalHold(database, {
        action: "placed",
        caseId: clientCase.id,
        documentId: created.document.id,
        reasonCode: "synthetic_pending_review",
        userId: owner.id,
      }),
      recordDocumentLegalHold(database, {
        action: "placed",
        caseId: clientCase.id,
        documentId: created.document.id,
        reasonCode: "synthetic_pending_review",
        userId: owner.id,
      }),
    ]);
    expect(
      holdResults.filter(({ status }) => status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      holdResults.filter(({ status }) => status === "rejected"),
    ).toHaveLength(1);
    await expect(
      database
        .select()
        .from(schema.documentLegalHoldEvents)
        .where(
          eq(schema.documentLegalHoldEvents.documentId, created.document.id),
        ),
    ).resolves.toHaveLength(1);
  });

  test("preserves exact evidence and immutable history after supersession and affiliation revocation", async () => {
    const owner = await createSyntheticUser("document-owner");
    const specialist = await createSyntheticUser("mortgage-specialist");
    const { case: clientCase, ownerMembership } = await createCaseWithOwner(
      database,
      { jurisdictionCode: "GA-FULTON-SUPERIOR", ownerUserId: owner.id },
    );
    const organization = await createVerifiedOrganization(
      "Synthetic Atlanta Mortgage Pilot",
      "lender",
      owner.id,
    );
    const organizationMembership = await createProfessionalMembership(
      specialist.id,
      organization.id,
    );
    const [specialistMembership] = await database
      .insert(schema.caseMemberships)
      .values({
        caseId: clientCase.id,
        organizationMembershipId: organizationMembership.id,
        role: "lender",
        status: "active",
        userId: specialist.id,
        validFrom: new Date(),
      })
      .returning();
    if (!specialistMembership) {
      throw new Error("Specialist membership was not created");
    }

    const created = await createDocumentWithVersion(database, {
      byteSize: 1024,
      caseId: clientCase.id,
      classification: "financial",
      confidentiality: "financial_restricted",
      contentHash: "1".repeat(64),
      format: "pdf",
      mimeType: "application/pdf",
      retentionClass: "pilot_financial_record",
      source: "client_upload",
      sourceReference: "synthetic-mortgage-statement-v1",
      title: "Synthetic mortgage statement",
      userId: owner.id,
    });
    const nativeDocument = await createDocumentWithVersion(database, {
      byteSize: 1536,
      caseId: clientCase.id,
      classification: "legal",
      confidentiality: "attorney_client",
      contentHash: "a".repeat(64),
      format: "docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      retentionClass: "pilot_legal_draft",
      source: "client_upload",
      sourceReference: "synthetic-settlement-draft-v1",
      title: "Synthetic settlement draft",
      userId: owner.id,
    });
    expect(nativeDocument.document.format).toBe("docx");
    expect(nativeDocument.version.mimeType).toContain(
      "officedocument.wordprocessingml.document",
    );

    const consents = await database
      .insert(schema.disclosureConsents)
      .values(
        (["view", "contribute"] as const).map((operation) => ({
          caseId: clientCase.id,
          classification: "financial" as const,
          grantorCaseMembershipId: ownerMembership.id,
          operation,
          purpose: "Synthetic mortgage transition review",
          recipientCaseMembershipId: specialistMembership.id,
          termsHash: operation === "view" ? "2".repeat(64) : "3".repeat(64),
        })),
      )
      .returning();
    const viewConsent = consents.find(({ operation }) => operation === "view");
    const contributeConsent = consents.find(
      ({ operation }) => operation === "contribute",
    );
    if (!viewConsent || !contributeConsent) {
      throw new Error("Review consents were not created");
    }
    await grantDocumentAccess(database, {
      caseId: clientCase.id,
      documentId: created.document.id,
      granteeCaseMembershipId: specialistMembership.id,
      grants: [
        { operation: "view", sourceConsentId: viewConsent.id },
        {
          operation: "contribute",
          sourceConsentId: contributeConsent.id,
        },
      ],
      userId: owner.id,
    });

    const review = await createProfessionalReview(database, {
      caseId: clientCase.id,
      classification: "financial",
      decisionContext: "Coordinate a synthetic property transition.",
      evidence: [
        {
          documentId: created.document.id,
          documentVersionId: created.version.id,
          purpose: "Establish the synthetic mortgage balance.",
        },
      ],
      responsibleCaseMembershipId: specialistMembership.id,
      responsibleGrantConsents: {
        contributeConsentId: contributeConsent.id,
        viewConsentId: viewConsent.id,
      },
      reviewScope: "Review supplied records without making eligibility claims.",
      statements: [
        {
          body: "Updated synthetic payoff information remains outstanding.",
          conditionStatus: "open",
          type: "outstanding_condition",
        },
      ],
      subjectType: "mortgage_property",
      userId: owner.id,
    });
    const inProgress = await appendProfessionalReviewRevision(database, {
      caseId: clientCase.id,
      decisionContext: "Specialist review is underway.",
      evidence: [
        {
          documentId: created.document.id,
          documentVersionId: created.version.id,
          purpose: "Original evidence retained for this revision.",
        },
      ],
      professionalReviewId: review.review.id,
      reviewScope: "Review the supplied synthetic statement.",
      status: "in_progress",
      userId: specialist.id,
    });
    const secondVersion = await addDocumentVersion(database, {
      byteSize: 2048,
      caseId: clientCase.id,
      contentHash: "4".repeat(64),
      documentId: created.document.id,
      format: "pdf",
      mimeType: "application/pdf",
      source: "client_upload",
      sourceReference: "synthetic-mortgage-statement-v2",
      userId: owner.id,
    });
    expect(secondVersion.supersedesVersionId).toBe(created.version.id);

    const reviewRevisionsAfterEvidenceChange = await database
      .select({ status: schema.professionalReviewRevisions.status })
      .from(schema.professionalReviewRevisions)
      .where(
        eq(
          schema.professionalReviewRevisions.professionalReviewId,
          review.review.id,
        ),
      )
      .orderBy(schema.professionalReviewRevisions.revision);
    expect(
      reviewRevisionsAfterEvidenceChange.map(({ status }) => status),
    ).toEqual(["assigned", "in_progress", "superseded"]);

    const evidence = await database
      .select()
      .from(schema.professionalReviewEvidence)
      .where(
        eq(schema.professionalReviewEvidence.reviewRevisionId, inProgress.id),
      );
    expect(evidence).toHaveLength(1);
    expect(evidence[0]?.documentVersionId).toBe(created.version.id);

    await expectDatabaseError(
      database
        .update(schema.documentVersions)
        .set({ contentHash: "5".repeat(64) })
        .where(eq(schema.documentVersions.id, created.version.id)),
      "55000",
    );
    await expectDatabaseError(
      database
        .delete(schema.professionalReviewRevisions)
        .where(eq(schema.professionalReviewRevisions.id, inProgress.id)),
      "55000",
    );

    await database
      .update(schema.organizationMemberships)
      .set({ revokedAt: new Date(), status: "revoked" })
      .where(eq(schema.organizationMemberships.id, organizationMembership.id));
    await expect(
      appendProfessionalReviewRevision(database, {
        caseId: clientCase.id,
        decisionContext: "This must be denied.",
        evidence: [],
        professionalReviewId: review.review.id,
        reviewScope: "No access after affiliation revocation.",
        status: "completed",
        userId: specialist.id,
      }),
    ).rejects.toMatchObject({ code: "RESOURCE_UNAVAILABLE" });
    expect(
      await database
        .select()
        .from(schema.professionalReviewRevisions)
        .where(
          eq(
            schema.professionalReviewRevisions.professionalReviewId,
            review.review.id,
          ),
        ),
    ).toHaveLength(3);
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
      ["property_status", "jointly_owned"],
      ["mortgage_status", "yes"],
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
