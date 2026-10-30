import { createHash, createHmac, randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { parseEnvironment } from "@resurgo/config";
import {
  acceptCaseMembership,
  addDocumentComment,
  addDocumentVersion,
  appendProfessionalReviewRevision,
  applicableDiscoveryQuestions,
  authorizeDocumentDisclosure,
  authorizeReviewDisclosure,
  completeDiscovery,
  computeProfessionalReviewStatementHash,
  createCaseWithOwner,
  createDatabase,
  createDocumentWithVersion,
  createProfessionalReview,
  grantCaseMembership,
  listAuthorizedDocuments,
  recordAttorneyReviewAcknowledgement,
  recordDocumentProcessingEvent,
  revokeDocumentDisclosure,
  saveDiscoveryAnswer,
  type DiscoveryAnswer,
  type DiscoveryAnswers,
} from "@resurgo/db";
import {
  createS3PrivateObjectStorage,
  documentObjectKeys,
  scanWithClamAv,
} from "@resurgo/documents/worker";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { processNextDocument } from "../../document-worker/src/worker";
import * as schema from "../../../packages/db/src/schema";
import { createResurgoAuth } from "../src/lib/auth-factory";

const DEMO_EMAILS = {
  attorney: "morgan.reed.demo@resurgo.local",
  client: "jordan.ellis.demo@resurgo.local",
  lender: "taylor.brooks.demo@resurgo.local",
} as const;
const repositoryRoot = resolve(import.meta.dirname, "../../..");
const CREDENTIALS_PATH = resolve(
  repositoryRoot,
  ".secrets/demo-credentials.json",
);
const environment = parseEnvironment(process.env);
if (environment.NODE_ENV === "production") {
  throw new Error("The synthetic demo seed is disabled in production");
}
const database = createDatabase(environment.DATABASE_URL);
const messages: Array<{ recipient: string; subject: string; text: string }> =
  [];
const auth = createResurgoAuth({
  appUrl: environment.NEXT_PUBLIC_APP_URL,
  database: database.db,
  emailSender: async (message) => {
    messages.push(message);
  },
  secret: environment.BETTER_AUTH_SECRET,
  secureCookies: false,
});

type DemoIdentity = {
  email: string;
  name: string;
  password: string;
  recoveryCodes: string[];
  totpSetupUri: string;
  userId: string;
};
type CredentialFile = {
  generatedAt: string;
  notice: string;
  accounts: Record<"attorney" | "client" | "lender", DemoIdentity>;
};

function password() {
  return `R!${randomBytes(24).toString("base64url")}a9`;
}

function responseCookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
}

async function authRequest(
  path: string,
  body?: Record<string, unknown>,
  cookie?: string,
) {
  return auth.handler(
    new Request(`${environment.NEXT_PUBLIC_APP_URL}/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
        origin: environment.NEXT_PUBLIC_APP_URL,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}

const base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32Decode(value: string) {
  let bits = "";
  for (const character of value.replaceAll("=", "").toUpperCase()) {
    const index = base32Alphabet.indexOf(character);
    if (index < 0) throw new Error("Invalid TOTP setup secret");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totpCode(setupUri: string, now = Date.now()) {
  const secret = new URL(setupUri).searchParams.get("secret");
  if (!secret) throw new Error("TOTP setup URI has no secret");
  const counter = Math.floor(now / 30_000);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret))
    .update(counterBytes)
    .digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    (((digest[offset]! & 0x7f) << 24) |
      (digest[offset + 1]! << 16) |
      (digest[offset + 2]! << 8) |
      digest[offset + 3]!) >>>
    0;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function createIdentity(
  name: string,
  email: string,
): Promise<DemoIdentity> {
  const accountPassword = password();
  const registration = await authRequest("/sign-up/email", {
    callbackURL: "/dashboard",
    email,
    name,
    password: accountPassword,
  });
  if (!registration.ok) {
    throw new Error(`Better Auth registration failed for ${email}`);
  }
  const verification = messages.find(
    (message) =>
      message.recipient === email && message.subject.includes("Verify"),
  );
  const verificationUrl = verification?.text.match(/https?:\/\/\S+/u)?.[0];
  if (!verificationUrl)
    throw new Error(`Verification URL missing for ${email}`);
  const verified = await auth.handler(new Request(verificationUrl));
  if (![200, 302].includes(verified.status)) {
    throw new Error(`Better Auth verification failed for ${email}`);
  }
  const login = await authRequest("/sign-in/email", {
    email,
    password: accountPassword,
  });
  if (!login.ok) throw new Error(`Better Auth sign-in failed for ${email}`);
  const cookie = responseCookie(login);
  const enabled = await authRequest(
    "/two-factor/enable",
    { issuer: "Resurgo Demo", method: "totp", password: accountPassword },
    cookie,
  );
  if (!enabled.ok) throw new Error(`MFA enrollment failed for ${email}`);
  const enrollment = (await enabled.json()) as {
    backupCodes: string[];
    totpURI: string;
  };
  const verifiedTotp = await authRequest(
    "/two-factor/verify-totp",
    { code: totpCode(enrollment.totpURI), trustDevice: false },
    cookie,
  );
  if (!verifiedTotp.ok) throw new Error(`MFA verification failed for ${email}`);
  const createdResult = await database.pool.query<{ id: string }>(
    "select id from auth.user where email = $1 limit 1",
    [email],
  );
  const created = createdResult.rows[0];
  if (!created) throw new Error(`Registered user missing for ${email}`);
  return {
    email,
    name,
    password: accountPassword,
    recoveryCodes: enrollment.backupCodes,
    totpSetupUri: enrollment.totpURI,
    userId: created.id,
  };
}

function answer(value: unknown): DiscoveryAnswer {
  return {
    source: "client_reported",
    status: "answered",
    value,
    verificationStatus: "client_confirmed",
  };
}

const scenarioAnswers: Record<string, unknown> = {
  asset_types: ["real_property", "retirement", "bank"],
  business_interest: "no",
  current_occupancy: "both",
  debt_certainty: "partial",
  desired_services: ["attorney", "mortgage", "financial"],
  divorce_stage: "negotiating",
  estimated_home_value: 350000,
  existing_orders: ["settlement_draft"],
  filed_case_reference: "FICTIONAL DEMO — Fulton DR-2026-DEMO",
  filing_jurisdiction_confirmed: "yes",
  financing_goal: "refinance",
  has_dependents: "no",
  housing_goal: "retain",
  income_sources: ["employment"],
  lender_review_status: "not_started",
  liability_summary: [
    {
      amount: 225000,
      description:
        "FICTIONAL jointly obligated mortgage; qualification conditions unresolved.",
    },
  ],
  mortgage_balance: 225000,
  mortgage_borrowers: ["client", "spouse"],
  mortgage_status: "yes",
  monthly_household_income: 9400,
  primary_goals:
    "FICTIONAL DEMO: retain the Atlanta home if a safe, professionally reviewed financing path is feasible.",
  property_status: "jointly_owned",
  refinance_deadline: "2027-05-29",
  representation_status: "represented",
  safe_to_contact: "yes",
  safety_concerns: ["none"],
  settlement_housing_condition: "yes",
  title_holders: ["client", "spouse"],
  valuation_status: "not_started",
};

async function completeScenario(caseId: string, userId: string) {
  let answers: DiscoveryAnswers = {};
  for (let step = 0; step < 100; step += 1) {
    const question = applicableDiscoveryQuestions(answers).find(
      ({ key }) => !answers[key],
    );
    if (!question) break;
    const configured = scenarioAnswers[question.key];
    let current: DiscoveryAnswer;
    if (configured !== undefined) {
      current = answer(configured);
    } else if (question.required) {
      const fallback =
        question.type === "multiple_choice"
          ? [question.options?.[0]?.value]
          : question.options?.[0]?.value;
      current =
        fallback === undefined
          ? {
              source: "client_reported",
              status: "deferred",
              value: null,
              verificationStatus: "unverified",
            }
          : answer(fallback);
    } else {
      current = {
        source: "client_reported",
        status: "deferred",
        value: null,
        verificationStatus: "unverified",
      };
    }
    await saveDiscoveryAnswer(database.db, {
      answer: current,
      caseId,
      questionKey: question.key,
      userId,
    });
    answers = { ...answers, [question.key]: current };
  }
  return completeDiscovery(database.db, { caseId, userId });
}

async function pdf(title: string, lines: string[]) {
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  page.drawText(
    "FICTIONAL SYNTHETIC DEMONSTRATION — NOT A REAL CLIENT RECORD",
    {
      color: rgb(0.65, 0.15, 0.12),
      font: bold,
      size: 10,
      x: 48,
      y: 748,
    },
  );
  page.drawText(title, { font: bold, size: 20, x: 48, y: 710 });
  let y = 675;
  for (const line of lines) {
    page.drawText(line, { font: regular, size: 11, x: 48, y });
    y -= 24;
  }
  return Buffer.from(await document.save());
}

async function docx(title: string, lines: string[]) {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                bold: true,
                color: "A12A24",
                text: "FICTIONAL SYNTHETIC DEMONSTRATION — NOT A REAL CLIENT RECORD",
              }),
            ],
          }),
          new Paragraph({ heading: HeadingLevel.TITLE, text: title }),
          ...lines.map((line) => new Paragraph({ text: line })),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}

const storage = createS3PrivateObjectStorage({
  accessKeyId: environment.GARAGE_ACCESS_KEY_ID,
  bucket: environment.GARAGE_BUCKET,
  endpoint: environment.GARAGE_ENDPOINT,
  region: environment.GARAGE_REGION,
  secretAccessKey: environment.GARAGE_SECRET_ACCESS_KEY,
});

async function processUntilAvailable(
  caseId: string,
  userId: string,
  versionId: string,
) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const documents = await listAuthorizedDocuments(database.db, {
      caseId,
      userId,
    });
    const candidate = documents.find(
      ({ version_id }) => version_id === versionId,
    );
    if (candidate?.processing_status === "available") return;
    if (candidate?.processing_status === "rejected") {
      throw new Error(`Synthetic document ${versionId} was rejected`);
    }
    await processNextDocument({
      database: database.db,
      scan: (bytes) =>
        scanWithClamAv(bytes, {
          host: environment.CLAMAV_HOST,
          port: environment.CLAMAV_PORT,
        }),
      storage,
    });
  }
  throw new Error(`Synthetic document ${versionId} did not become available`);
}

async function uploadDocument(input: {
  bytes: Buffer;
  caseId: string;
  classification: "financial" | "legal" | "shared";
  confidentiality: "confidential" | "financial_restricted";
  format: "docx" | "pdf";
  mimeType: string;
  title: string;
  userId: string;
}) {
  const created = await createDocumentWithVersion(database.db, {
    byteSize: input.bytes.byteLength,
    caseId: input.caseId,
    classification: input.classification,
    confidentiality: input.confidentiality,
    contentHash: createHash("sha256").update(input.bytes).digest("hex"),
    format: input.format,
    mimeType: input.mimeType,
    recordInitialQuarantineEvent: false,
    retentionClass: "synthetic_demo_record",
    source: "client_upload",
    title: input.title,
    userId: input.userId,
  });
  const keys = documentObjectKeys({
    caseId: input.caseId,
    documentId: created.document.id,
    versionId: created.version.id,
  });
  await storage.put({
    body: input.bytes,
    contentHash: created.version.contentHash,
    contentType: input.mimeType,
    key: keys.quarantine,
  });
  await recordDocumentProcessingEvent(database.db, {
    caseId: input.caseId,
    documentId: created.document.id,
    status: "quarantined",
    userId: input.userId,
    versionId: created.version.id,
  });
  await processUntilAvailable(input.caseId, input.userId, created.version.id);
  return created;
}

async function uploadVersion(input: {
  bytes: Buffer;
  caseId: string;
  documentId: string;
  mimeType: string;
  userId: string;
}) {
  const version = await addDocumentVersion(database.db, {
    byteSize: input.bytes.byteLength,
    caseId: input.caseId,
    contentHash: createHash("sha256").update(input.bytes).digest("hex"),
    documentId: input.documentId,
    format: "docx",
    mimeType: input.mimeType,
    recordInitialQuarantineEvent: false,
    source: "client_upload",
    userId: input.userId,
  });
  const keys = documentObjectKeys({
    caseId: input.caseId,
    documentId: input.documentId,
    versionId: version.id,
  });
  await storage.put({
    body: input.bytes,
    contentHash: version.contentHash,
    contentType: input.mimeType,
    key: keys.quarantine,
  });
  await recordDocumentProcessingEvent(database.db, {
    caseId: input.caseId,
    documentId: input.documentId,
    status: "quarantined",
    userId: input.userId,
    versionId: version.id,
  });
  await processUntilAvailable(input.caseId, input.userId, version.id);
  return version;
}

async function existingCredentials() {
  try {
    return JSON.parse(
      await readFile(CREDENTIALS_PATH, "utf8"),
    ) as CredentialFile;
  } catch {
    return undefined;
  }
}

async function main() {
  const stored = await existingCredentials();
  const existingClientResult = await database.pool.query<{ id: string }>(
    "select id from auth.user where email = $1 limit 1",
    [DEMO_EMAILS.client],
  );
  const existingClient = existingClientResult.rows[0];
  if (existingClient) {
    if (!stored) {
      throw new Error(
        "Demo identities already exist but the ignored credential file is missing. Run the documented local demo reset before reseeding.",
      );
    }
    const completionResult = await database.pool.query<{
      available_versions: number;
      case_id: string;
      reviews: number;
    }>(
      `select
         c.id as case_id,
         count(distinct dv.id) filter (where dv.processing_status = 'available')::int as available_versions,
         count(distinct pr.id)::int as reviews
       from resurgo.cases c
       join resurgo.case_memberships cm
         on cm.case_id = c.id
        and cm.user_id = $1
        and cm.role = 'owner'
       left join resurgo.document_versions dv on dv.case_id = c.id
       left join resurgo.professional_reviews pr on pr.case_id = c.id
       where c.jurisdiction_code = 'GA-FULTON-SUPERIOR'
       group by c.id
       order by c.created_at desc
       limit 1`,
      [existingClient.id],
    );
    const completed = completionResult.rows[0];
    if (
      !completed ||
      completed.available_versions < 6 ||
      completed.reviews < 1
    ) {
      throw new Error(
        "A partial synthetic demo seed was detected. Run pnpm demo:reset to rebuild it safely.",
      );
    }
    console.log("Synthetic demo is already seeded.");
    console.log(`Case: ${completed.case_id}`);
    console.log(`Credentials: ${CREDENTIALS_PATH}`);
    return;
  }

  const client = await createIdentity("Jordan Ellis", DEMO_EMAILS.client);
  const attorney = await createIdentity("Morgan Reed", DEMO_EMAILS.attorney);
  const lender = await createIdentity("Taylor Brooks", DEMO_EMAILS.lender);
  const credentials: CredentialFile = {
    generatedAt: new Date().toISOString(),
    notice: "FICTIONAL SYNTHETIC DEMONSTRATION ACCOUNTS — LOCAL USE ONLY",
    accounts: { attorney, client, lender },
  };
  await mkdir(resolve(repositoryRoot, ".secrets"), {
    mode: 0o700,
    recursive: true,
  });
  await writeFile(
    CREDENTIALS_PATH,
    `${JSON.stringify(credentials, null, 2)}\n`,
    {
      mode: 0o600,
    },
  );
  await chmod(CREDENTIALS_PATH, 0o600);

  const [lawFirm, lenderOrganization] = await database.db
    .insert(schema.organizations)
    .values([
      {
        name: "Peachtree Family Law Demo Practice",
        pilotStatus: "verified",
        slug: "peachtree-family-law-demo",
        type: "law_firm",
        verifiedAt: new Date(),
        verifiedByUserId: client.userId,
      },
      {
        name: "Piedmont Mortgage Transition Demo Group",
        pilotStatus: "verified",
        slug: "piedmont-mortgage-transition-demo",
        type: "lender",
        verifiedAt: new Date(),
        verifiedByUserId: client.userId,
      },
    ])
    .returning();
  if (!lawFirm || !lenderOrganization)
    throw new Error("Demo organizations missing");
  const [attorneyOrganizationMembership, lenderOrganizationMembership] =
    await database.db
      .insert(schema.organizationMemberships)
      .values([
        {
          organizationId: lawFirm.id,
          role: "professional",
          status: "active",
          userId: attorney.userId,
          validFrom: new Date(),
        },
        {
          organizationId: lenderOrganization.id,
          role: "professional",
          status: "active",
          userId: lender.userId,
          validFrom: new Date(),
        },
      ])
      .returning();
  if (!attorneyOrganizationMembership || !lenderOrganizationMembership) {
    throw new Error("Demo professional memberships missing");
  }

  const createdCase = await createCaseWithOwner(database.db, {
    jurisdictionCode: "GA-FULTON-SUPERIOR",
    ownerUserId: client.userId,
  });
  const discovery = await completeScenario(createdCase.case.id, client.userId);

  const invitedAttorney = await grantCaseMembership(database.db, {
    actorUserId: client.userId,
    caseId: createdCase.case.id,
    organizationMembershipId: attorneyOrganizationMembership.id,
    role: "attorney",
    userId: attorney.userId,
  });
  const invitedLender = await grantCaseMembership(database.db, {
    actorUserId: client.userId,
    caseId: createdCase.case.id,
    organizationMembershipId: lenderOrganizationMembership.id,
    role: "lender",
    userId: lender.userId,
  });
  await acceptCaseMembership(database.db, {
    caseId: createdCase.case.id,
    membershipId: invitedAttorney.id,
    userId: attorney.userId,
  });
  await acceptCaseMembership(database.db, {
    caseId: createdCase.case.id,
    membershipId: invitedLender.id,
    userId: lender.userId,
  });

  const mortgage = await uploadDocument({
    bytes: await pdf("Synthetic Mortgage Statement", [
      "Borrowers: Jordan Ellis and fictional spouse",
      "Property value estimate: $350,000 (not an appraisal)",
      "Outstanding principal balance: $225,000",
      "Current note rate: 3.500%",
      "Proposed outcome: Jordan retains the home",
    ]),
    caseId: createdCase.case.id,
    classification: "financial",
    confidentiality: "financial_restricted",
    format: "pdf",
    mimeType: "application/pdf",
    title: "Fictional current mortgage statement",
    userId: client.userId,
  });
  const property = await uploadDocument({
    bytes: await pdf("Synthetic Property Ownership Summary", [
      "Fulton County, Georgia",
      "Title: jointly owned by Jordan Ellis and fictional spouse",
      "Occupancy: both spouses",
      "Prepared only for the Resurgo design-partner demonstration",
    ]),
    caseId: createdCase.case.id,
    classification: "financial",
    confidentiality: "financial_restricted",
    format: "pdf",
    mimeType: "application/pdf",
    title: "Fictional property ownership summary",
    userId: client.userId,
  });
  const worksheet = await uploadDocument({
    bytes: await docx("Synthetic Financial Disclosure Worksheet", [
      "Estimated home value: $350,000",
      "Outstanding mortgage: $225,000",
      "Proposed equity buyout: $62,500",
      "Income and qualification evidence remain incomplete.",
    ]),
    caseId: createdCase.case.id,
    classification: "financial",
    confidentiality: "financial_restricted",
    format: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    title: "Fictional financial disclosure worksheet",
    userId: client.userId,
  });
  const settlement = await uploadDocument({
    bytes: await docx("Draft Synthetic Marital Settlement Agreement", [
      "Jordan Ellis proposes retaining the marital residence.",
      "Proposed equity buyout: $62,500.",
      "Draft requires refinance within 90 days after entry of the decree.",
      "This language has not been approved by a court or attorney.",
    ]),
    caseId: createdCase.case.id,
    classification: "legal",
    confidentiality: "confidential",
    format: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    title: "Fictional draft marital settlement agreement",
    userId: client.userId,
  });
  await uploadDocument({
    bytes: await pdf("Synthetic Mortgage Feasibility Assessment", [
      "Purpose: coordinate questions; not a preapproval or underwriting decision.",
      "Higher-rate refinancing may materially change the monthly payment.",
      "Qualification conditions remain unresolved.",
      "Income, appraisal, credit, debt, and final settlement terms require review.",
    ]),
    caseId: createdCase.case.id,
    classification: "financial",
    confidentiality: "financial_restricted",
    format: "pdf",
    mimeType: "application/pdf",
    title: "Fictional mortgage feasibility assessment",
    userId: client.userId,
  });
  await uploadVersion({
    bytes: await docx("Revised Synthetic Marital Settlement Agreement", [
      "Jordan Ellis proposes retaining the marital residence.",
      "Proposed equity buyout: $62,500.",
      "REVISED: refinance deadline proposed as 120 days after the decree.",
      "Revision responds to unresolved lender conditions; attorney review remains required.",
    ]),
    caseId: createdCase.case.id,
    documentId: settlement.document.id,
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    userId: client.userId,
  });

  const mortgageDisclosure = await authorizeDocumentDisclosure(database.db, {
    caseId: createdCase.case.id,
    documentId: mortgage.document.id,
    operations: ["view", "download", "contribute"],
    purpose: "Assess the fictional refinance and equity-buyout proposal",
    recipientCaseMembershipId: invitedLender.id,
    userId: client.userId,
  });
  await authorizeDocumentDisclosure(database.db, {
    caseId: createdCase.case.id,
    documentId: worksheet.document.id,
    operations: ["view"],
    purpose: "Review fictional financing assumptions",
    recipientCaseMembershipId: invitedLender.id,
    userId: client.userId,
  });
  await authorizeDocumentDisclosure(database.db, {
    caseId: createdCase.case.id,
    documentId: property.document.id,
    operations: ["view"],
    purpose: "Temporary fictional title-fact verification",
    recipientCaseMembershipId: invitedLender.id,
    userId: client.userId,
  });
  await revokeDocumentDisclosure(database.db, {
    caseId: createdCase.case.id,
    documentId: property.document.id,
    recipientCaseMembershipId: invitedLender.id,
    userId: client.userId,
  });
  await authorizeDocumentDisclosure(database.db, {
    caseId: createdCase.case.id,
    documentId: settlement.document.id,
    operations: ["view"],
    purpose: "Review only the fictional settlement language",
    recipientCaseMembershipId: invitedAttorney.id,
    userId: client.userId,
  });
  await addDocumentComment(database.db, {
    anchor: { page: 1, x: 0.18, y: 0.52 },
    body: "The 90-day deadline should remain conditional until income, appraisal, and qualification evidence are reviewed.",
    caseId: createdCase.case.id,
    documentId: mortgage.document.id,
    kind: "highlight",
    userId: lender.userId,
    versionId: mortgage.version.id,
  });

  const reviewTrigger = discovery.outputs.find(
    ({ type, code }) =>
      type === "review_trigger" && /mortgage|refinance|housing/u.test(code),
  );
  if (!reviewTrigger) throw new Error("Mortgage discovery trigger missing");
  const viewConsent = mortgageDisclosure.consents.find(
    ({ operation }) => operation === "view",
  );
  const contributeConsent = mortgageDisclosure.consents.find(
    ({ operation }) => operation === "contribute",
  );
  if (!viewConsent || !contributeConsent)
    throw new Error("Review consents missing");
  const review = await createProfessionalReview(database.db, {
    caseId: createdCase.case.id,
    classification: "financial",
    decisionContext:
      "Can the proposed 90-day refinance condition be treated as feasible before settlement language is finalized?",
    evidence: [
      {
        documentId: mortgage.document.id,
        documentVersionId: mortgage.version.id,
        purpose: "Verify fictional balance, borrowers, and current rate",
      },
    ],
    responsibleCaseMembershipId: invitedLender.id,
    responsibleGrantConsents: {
      contributeConsentId: contributeConsent.id,
      viewConsentId: viewConsent.id,
    },
    reviewScope:
      "Identify financing assumptions and unresolved conditions without making an underwriting decision.",
    settlement: {
      equityBuyoutAmount: "62500.00",
      existingMortgageResponsibility:
        "Both fictional spouses remain liable on the $225,000 mortgage until payoff or an approved closing.",
      financingAssumptions:
        "Proposed refinance within 90 days at a likely higher rate; qualification has not been established.",
      propertyDisposition: "retain_by_client",
      proposedPathway: "refinance",
      proposedSettlementDeadline: new Date("2027-05-29T12:00:00.000Z"),
      reviewStage: "feasibility_review",
    },
    sourceDiscoveryOutputId: reviewTrigger.id,
    subjectResourceId: mortgage.document.caseResourceId,
    subjectType: "mortgage_property",
    userId: client.userId,
  });
  await appendProfessionalReviewRevision(database.db, {
    caseId: createdCase.case.id,
    decisionContext: "The fictional settlement financing review is underway.",
    evidence: [
      {
        documentId: mortgage.document.id,
        documentVersionId: mortgage.version.id,
        purpose: "Current synthetic mortgage evidence",
      },
    ],
    professionalReviewId: review.review.id,
    reviewScope: "Assess factual financing conditions only.",
    settlement: {
      equityBuyoutAmount: "62500.00",
      existingMortgageResponsibility:
        "Both fictional spouses remain liable until payoff or approved closing.",
      financingAssumptions:
        "A higher-rate refinance and $62,500 buyout are proposed within 90 days.",
      propertyDisposition: "retain_by_client",
      proposedPathway: "refinance",
      proposedSettlementDeadline: new Date("2027-05-29T12:00:00.000Z"),
      reviewStage: "feasibility_review",
    },
    status: "in_progress",
    userId: lender.userId,
  });
  const completed = await appendProfessionalReviewRevision(database.db, {
    caseId: createdCase.case.id,
    decisionContext:
      "The proposed 90-day refinance condition has unresolved feasibility dependencies.",
    evidence: [
      {
        documentId: mortgage.document.id,
        documentVersionId: mortgage.version.id,
        purpose: "Exact statement version supporting factual findings",
      },
    ],
    professionalReviewId: review.review.id,
    reviewScope:
      "Record unresolved conditions; do not issue preapproval, underwriting approval, or closing assurance.",
    settlement: {
      equityBuyoutAmount: "62500.00",
      existingMortgageResponsibility:
        "Both fictional spouses remain contractually liable until payoff or an approved closing.",
      financingAssumptions:
        "Refinancing $225,000 plus the proposed buyout may increase payment at current market rates.",
      lenderFindings:
        "The 90-day pathway is not yet established. Higher-rate refinancing may materially increase payment.",
      outstandingConditions:
        "Verify income, credit, debt ratios, appraisal, final buyout funds, and executed settlement terms.",
      propertyDisposition: "retain_by_client",
      proposedPathway: "refinance",
      proposedSettlementDeadline: new Date("2027-05-29T12:00:00.000Z"),
      reviewStage: "feasibility_review",
    },
    statements: [
      {
        body: "The 90-day refinance condition remains unverified and may require revised settlement timing.",
        conditionStatus: "open",
        type: "outstanding_condition",
      },
      {
        body: "Higher-rate refinancing may increase the proposed post-divorce housing payment.",
        type: "finding",
      },
    ],
    status: "completed",
    userId: lender.userId,
  });
  await authorizeReviewDisclosure(database.db, {
    caseId: createdCase.case.id,
    professionalReviewId: review.review.id,
    purpose:
      "Attorney review of disclosed financing findings before final terms",
    recipientCaseMembershipId: invitedAttorney.id,
    userId: client.userId,
  });
  await recordAttorneyReviewAcknowledgement(database.db, {
    action: "acknowledged",
    caseId: createdCase.case.id,
    note: "The unresolved financing conditions should be addressed through revised settlement language, additional time, or another professionally reviewed contingency before finalization.",
    professionalReviewId: review.review.id,
    reviewRevisionId: completed.id,
    statementHash: computeProfessionalReviewStatementHash({
      decisionContext:
        "The proposed 90-day refinance condition has unresolved feasibility dependencies.",
      reviewScope:
        "Record unresolved conditions; do not issue preapproval, underwriting approval, or closing assurance.",
      statements: [
        {
          body: "The 90-day refinance condition remains unverified and may require revised settlement timing.",
          conditionStatus: "open",
          type: "outstanding_condition",
        },
        {
          body: "Higher-rate refinancing may increase the proposed post-divorce housing payment.",
          type: "finding",
        },
      ],
    }),
    userId: attorney.userId,
  });

  console.log("Synthetic Atlanta homeowner demo seeded successfully.");
  console.log(`Case: ${createdCase.case.id}`);
  console.log(`Credentials: ${CREDENTIALS_PATH}`);
  console.log("All records and documents are explicitly fictional.");
}

void main()
  .then(async () => database.pool.end())
  .catch(async (error: unknown) => {
    await database.pool.end();
    console.error(error instanceof Error ? error.message : "Demo seed failed");
    process.exitCode = 1;
  });
