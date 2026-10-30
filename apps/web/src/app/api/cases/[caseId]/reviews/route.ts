import {
  appendProfessionalReviewRevision,
  AuthorizationDeniedError,
  createProfessionalReview,
  findActiveReviewConsentIds,
  listAuthorizedDocuments,
  recordAttorneyReviewAcknowledgement,
} from "@resurgo/db";
import { z } from "zod";

import { getAuth, getDatabase } from "../../../../../lib/auth";

const bodySchema = z.object({
  decisionContext: z.string().trim().min(3).max(2000),
  documentId: z.uuid(),
  purpose: z.string().trim().min(3).max(1000),
  responsibleCaseMembershipId: z.uuid(),
  reviewScope: z.string().trim().min(3).max(4000),
  versionId: z.uuid(),
  sourceDiscoveryOutputId: z.uuid().optional(),
  settlement: z
    .object({
      equityBuyoutAmount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/u)
        .optional(),
      existingMortgageResponsibility: z.string().trim().min(3).max(2000),
      financingAssumptions: z.string().trim().min(3).max(4000),
      propertyDisposition: z.enum([
        "retain_by_client",
        "retain_by_spouse",
        "sell",
        "undecided",
        "other",
      ]),
      proposedPathway: z.enum([
        "refinance",
        "assumption",
        "sale",
        "payoff",
        "other",
        "undecided",
      ]),
      proposedSettlementDeadline: z.coerce.date().optional(),
      reviewStage: z.literal("feasibility_review"),
    })
    .optional(),
});

const revisionSchema = z.object({
  decisionContext: z.string().trim().min(3).max(2000),
  evidence: z
    .array(
      z.object({
        documentId: z.uuid(),
        documentVersionId: z.uuid(),
        purpose: z.string().trim().min(3).max(1000),
      }),
    )
    .min(1)
    .max(25),
  professionalReviewId: z.uuid(),
  reviewScope: z.string().trim().min(3).max(4000),
  statements: z
    .array(
      z.object({
        body: z.string().trim().min(3).max(4000),
        conditionStatus: z
          .enum(["open", "satisfied", "waived", "not_applicable"])
          .optional(),
        type: z.enum([
          "finding",
          "outstanding_condition",
          "clarification_request",
        ]),
      }),
    )
    .max(50),
  status: z.enum([
    "in_progress",
    "clarification_required",
    "completed",
    "withdrawn",
  ]),
  settlement: z
    .object({
      equityBuyoutAmount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/u)
        .optional(),
      existingMortgageResponsibility: z.string().trim().min(3).max(2000),
      financingAssumptions: z.string().trim().min(3).max(4000),
      lenderFindings: z.string().trim().min(3).max(8000).optional(),
      outstandingConditions: z.string().trim().min(3).max(8000).optional(),
      propertyDisposition: z.enum([
        "retain_by_client",
        "retain_by_spouse",
        "sell",
        "undecided",
        "other",
      ]),
      proposedPathway: z.enum([
        "refinance",
        "assumption",
        "sale",
        "payoff",
        "other",
        "undecided",
      ]),
      proposedSettlementDeadline: z.coerce.date().optional(),
      reviewStage: z.literal("feasibility_review"),
    })
    .optional(),
});

const acknowledgementSchema = z.object({
  action: z.enum(["acknowledged", "withdrawn"]),
  professionalReviewId: z.uuid(),
  reviewRevisionId: z.uuid(),
  statementHash: z.string().regex(/^[0-9a-f]{64}$/u),
  note: z.string().trim().min(3).max(4000).optional(),
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
    const documents = await listAuthorizedDocuments(getDatabase(), {
      caseId,
      userId: session.user.id,
    });
    const document = documents.find(
      ({ document_id, processing_status, version_id }) =>
        document_id === parsed.data.documentId &&
        version_id === parsed.data.versionId &&
        processing_status === "available",
    );
    if (!document) throw new AuthorizationDeniedError();
    const consents = await findActiveReviewConsentIds(getDatabase(), {
      caseId,
      classification: document.classification,
      recipientCaseMembershipId: parsed.data.responsibleCaseMembershipId,
      userId: session.user.id,
    });
    const settlement = parsed.data.settlement
      ? {
          existingMortgageResponsibility:
            parsed.data.settlement.existingMortgageResponsibility,
          financingAssumptions: parsed.data.settlement.financingAssumptions,
          propertyDisposition: parsed.data.settlement.propertyDisposition,
          proposedPathway: parsed.data.settlement.proposedPathway,
          reviewStage: parsed.data.settlement.reviewStage,
          ...(parsed.data.settlement.equityBuyoutAmount
            ? { equityBuyoutAmount: parsed.data.settlement.equityBuyoutAmount }
            : {}),
          ...(parsed.data.settlement.proposedSettlementDeadline
            ? {
                proposedSettlementDeadline:
                  parsed.data.settlement.proposedSettlementDeadline,
              }
            : {}),
        }
      : undefined;
    const review = await createProfessionalReview(getDatabase(), {
      caseId,
      classification: document.classification,
      decisionContext: parsed.data.decisionContext,
      evidence: [
        {
          documentId: document.document_id,
          documentVersionId: document.version_id,
          purpose: parsed.data.purpose,
        },
      ],
      responsibleCaseMembershipId: parsed.data.responsibleCaseMembershipId,
      responsibleGrantConsents: {
        contributeConsentId: consents.contribute,
        viewConsentId: consents.view,
      },
      reviewScope: parsed.data.reviewScope,
      ...(settlement ? { settlement } : {}),
      ...(parsed.data.sourceDiscoveryOutputId
        ? { sourceDiscoveryOutputId: parsed.data.sourceDiscoveryOutputId }
        : {}),
      subjectResourceId: document.resource_id,
      subjectType: parsed.data.settlement
        ? "mortgage_property"
        : "document_set",
      userId: session.user.id,
    });
    return Response.json(
      { reviewId: review.review.id },
      { status: 201, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: "Review assignment could not be created" },
      { status: error instanceof AuthorizationDeniedError ? 404 : 409 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { caseId } = await context.params;
  const parsed = revisionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.uuid().safeParse(caseId).success || !parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const {
      settlement: parsedSettlement,
      statements: parsedStatements,
      ...revisionData
    } = parsed.data;
    const settlement = parsedSettlement
      ? {
          existingMortgageResponsibility:
            parsedSettlement.existingMortgageResponsibility,
          financingAssumptions: parsedSettlement.financingAssumptions,
          propertyDisposition: parsedSettlement.propertyDisposition,
          proposedPathway: parsedSettlement.proposedPathway,
          reviewStage: parsedSettlement.reviewStage,
          ...(parsedSettlement.equityBuyoutAmount
            ? { equityBuyoutAmount: parsedSettlement.equityBuyoutAmount }
            : {}),
          ...(parsedSettlement.lenderFindings
            ? { lenderFindings: parsedSettlement.lenderFindings }
            : {}),
          ...(parsedSettlement.outstandingConditions
            ? {
                outstandingConditions: parsedSettlement.outstandingConditions,
              }
            : {}),
          ...(parsedSettlement.proposedSettlementDeadline
            ? {
                proposedSettlementDeadline:
                  parsedSettlement.proposedSettlementDeadline,
              }
            : {}),
        }
      : undefined;
    const revision = await appendProfessionalReviewRevision(getDatabase(), {
      caseId,
      userId: session.user.id,
      ...revisionData,
      ...(settlement ? { settlement } : {}),
      statements: parsedStatements.map(({ body, conditionStatus, type }) => ({
        body,
        type,
        ...(conditionStatus ? { conditionStatus } : {}),
      })),
    });
    return Response.json(
      { revisionId: revision.id },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: "Review update could not be recorded" },
      { status: error instanceof AuthorizationDeniedError ? 404 : 409 },
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { caseId } = await context.params;
  const parsed = acknowledgementSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!z.uuid().safeParse(caseId).success || !parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    await recordAttorneyReviewAcknowledgement(getDatabase(), {
      caseId,
      userId: session.user.id,
      action: parsed.data.action,
      professionalReviewId: parsed.data.professionalReviewId,
      reviewRevisionId: parsed.data.reviewRevisionId,
      statementHash: parsed.data.statementHash,
      ...(parsed.data.note ? { note: parsed.data.note } : {}),
    });
    return Response.json(
      { acknowledged: parsed.data.action === "acknowledged" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: "Acknowledgement could not be recorded" },
      { status: error instanceof AuthorizationDeniedError ? 404 : 409 },
    );
  }
}
