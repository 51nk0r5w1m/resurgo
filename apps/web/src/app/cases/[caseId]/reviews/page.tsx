import {
  listAuthorizedCaseMembers,
  listAuthorizedDocuments,
  listAuthorizedProfessionalReviews,
  listReviewPrerequisites,
  requireCaseAuthorization,
} from "@resurgo/db";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
import { ProfessionalReviewAction } from "../../../../components/professional-review-action";
import { ReviewAssignmentForm } from "../../../../components/review-assignment-form";
import { ReviewDisclosureForm } from "../../../../components/review-disclosure-form";
import { getAuth, getDatabase } from "../../../../lib/auth";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  const [reviews, members, documents, authorization, prerequisites] =
    await Promise.all([
      listAuthorizedProfessionalReviews(getDatabase(), {
        caseId,
        userId: session.user.id,
      }),
      listAuthorizedCaseMembers(getDatabase(), {
        caseId,
        userId: session.user.id,
      }),
      listAuthorizedDocuments(getDatabase(), {
        caseId,
        userId: session.user.id,
      }),
      requireCaseAuthorization(getDatabase(), {
        caseId,
        operation: "read",
        userId: session.user.id,
      }),
      listReviewPrerequisites(getDatabase(), {
        caseId,
        userId: session.user.id,
      }).catch(() => []),
    ]).catch(() => notFound());
  return (
    <main className="case-page">
      <CasePageHeader
        eyebrow="Professional Review Register"
        summary={
          authorization.role === "lender"
            ? "Review only the financial evidence the client authorized, record financing conditions, and distinguish feasibility from underwriting approval."
            : authorization.role === "attorney"
              ? "Review the findings the client authorized for disclosure without receiving the specialist's restricted source documents."
              : "Each review remains tied to the exact evidence versions used. New evidence supersedes history rather than rewriting it."
        }
        title={
          authorization.role === "lender"
            ? "Evaluate the housing plan before settlement"
            : authorization.role === "attorney"
              ? "Connect financing findings to settlement terms"
              : "Accountable professional review"
        }
      />
      {(authorization.role === "lender" ||
        authorization.role === "attorney") && (
        <section className="workspace-card professional-workflow-intro">
          <div>
            <p className="eyebrow">
              {authorization.role === "lender"
                ? "Assigned mortgage review"
                : "Authorized findings review"}
            </p>
            <h2>
              {authorization.role === "lender"
                ? "A 90-day refinance deadline depends on unresolved financing conditions."
                : "Financing conditions should be visible before settlement language is finalized."}
            </h2>
          </div>
          {authorization.role === "lender" ? (
            <ol>
              <li>
                Examine only the mortgage evidence disclosed for this review.
              </li>
              <li>
                Record feasibility concerns and outstanding conditions below.
              </li>
              <li>
                Submit findings without implying preapproval or underwriting
                approval.
              </li>
            </ol>
          ) : (
            <ol>
              <li>Read the client-authorized specialist findings.</li>
              <li>Assess their effect on settlement language and timing.</li>
              <li>Acknowledge the exact immutable review revision below.</li>
            </ol>
          )}
        </section>
      )}
      {authorization.role === "owner" && (
        <details className="workspace-card review-assignment-disclosure">
          <summary>
            <span>
              <strong>Assign another professional review</strong>
              <small>
                Choose an approved trigger, responsible professional, and exact
                evidence version.
              </small>
            </span>
          </summary>
          <ReviewAssignmentForm
            caseId={caseId}
            documents={documents
              .filter(
                ({ processing_status }) => processing_status === "available",
              )
              .map((document) => ({
                id: document.document_id,
                title: document.title,
                versionId: document.version_id,
                versionNumber: document.version_number,
              }))}
            professionals={members
              .filter(
                (member) =>
                  member.status === "active" && member.role === "lender",
              )
              .map((member) => ({
                id: member.id,
                name: member.name,
                role: member.role,
              }))}
            reviewTriggers={prerequisites
              .filter(({ status }) => status === "outstanding")
              .map(({ sourceDiscoveryOutputId, title }) => ({
                id: sourceDiscoveryOutputId,
                title,
              }))}
          />
        </details>
      )}
      {reviews.length === 0 ? (
        <section className="workspace-card empty-state">
          <h2>No reviews assigned yet</h2>
          <p>
            Reviews will appear only after a verified case professional receives
            explicit access to the required evidence.
          </p>
        </section>
      ) : (
        <ol className="review-register-list">
          {reviews.map((review) => (
            <li className="workspace-card" key={review.professionalReviewId}>
              <div className="card-heading-row">
                <div>
                  <p className="eyebrow">
                    {review.subjectType.replaceAll("_", " ")}
                  </p>
                  <h2>{review.decisionContext}</h2>
                  <p>
                    {review.professionalName} · revision {review.revision}
                  </p>
                </div>
                <span className="document-status">
                  {review.status.replaceAll("_", " ")}
                </span>
              </div>
              <p>{review.reviewScope}</p>
              <h3>Evidence</h3>
              {review.evidence.length === 0 ? (
                <p>No evidence is currently disclosed for this review.</p>
              ) : (
                <ul>
                  {review.evidence.map((item) => (
                    <li key={item.documentVersionId}>
                      {item.title} · version {item.versionNumber} —{" "}
                      {item.purpose}
                    </li>
                  ))}
                </ul>
              )}
              <h3>Findings and conditions</h3>
              {review.statements.length === 0 ? (
                <p>No findings have been recorded.</p>
              ) : (
                <ul>
                  {review.statements.map((statement, index) => (
                    <li key={`${statement.type}-${index}`}>
                      {statement.body}
                      {statement.conditionStatus
                        ? ` · ${statement.conditionStatus.replaceAll("_", " ")}`
                        : ""}
                    </li>
                  ))}
                </ul>
              )}
              {review.propertyDisposition && (
                <section className="settlement-review-summary">
                  <p className="eyebrow">Settlement Feasibility Review</p>
                  <h3>Housing proposal and financing context</h3>
                  <dl>
                    <div>
                      <dt>Property disposition</dt>
                      <dd>{review.propertyDisposition.replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt>Proposed pathway</dt>
                      <dd>{review.proposedPathway?.replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt>Mortgage responsibility</dt>
                      <dd>{review.existingMortgageResponsibility}</dd>
                    </div>
                    <div>
                      <dt>Financing assumptions</dt>
                      <dd>{review.financingAssumptions}</dd>
                    </div>
                    {review.lenderFindings && (
                      <div>
                        <dt>Lender findings</dt>
                        <dd>{review.lenderFindings}</dd>
                      </div>
                    )}
                    {review.outstandingConditions && (
                      <div>
                        <dt>Outstanding conditions</dt>
                        <dd>{review.outstandingConditions}</dd>
                      </div>
                    )}
                  </dl>
                  <p className="review-boundary-note">
                    Financing feasibility is distinct from preapproval,
                    underwriting approval, and closing.
                  </p>
                </section>
              )}
              {review.acknowledgements.length > 0 && (
                <div className="review-acknowledgements">
                  <h3>Attorney acknowledgement</h3>
                  {review.acknowledgements.map((item) => (
                    <p
                      key={`${item.attorneyName}-${item.occurredAt.toISOString()}`}
                    >
                      {item.attorneyName} acknowledged this exact immutable
                      revision.{item.note ? ` ${item.note}` : ""}
                    </p>
                  ))}
                </div>
              )}
              <ProfessionalReviewAction
                canAcknowledge={authorization.role === "attorney"}
                canContribute={
                  authorization.role === "owner" ||
                  authorization.caseMembershipId ===
                    review.responsibleCaseMembershipId
                }
                caseId={caseId}
                decisionContext={review.decisionContext}
                evidence={review.evidence.map((item) => ({
                  documentId: item.documentId,
                  documentVersionId: item.documentVersionId,
                  purpose: item.purpose,
                }))}
                professionalReviewId={review.professionalReviewId}
                reviewRevisionId={review.reviewRevisionId}
                reviewScope={review.reviewScope}
                statementHash={review.statementHash}
                status={review.status}
                settlement={
                  review.propertyDisposition
                    ? {
                        equityBuyoutAmount: review.equityBuyoutAmount,
                        existingMortgageResponsibility:
                          review.existingMortgageResponsibility!,
                        financingAssumptions: review.financingAssumptions!,
                        lenderFindings: review.lenderFindings,
                        outstandingConditions: review.outstandingConditions,
                        propertyDisposition: review.propertyDisposition,
                        proposedPathway: review.proposedPathway!,
                        proposedSettlementDeadline:
                          review.proposedSettlementDeadline?.toISOString() ??
                          null,
                        reviewStage: review.reviewStage!,
                      }
                    : null
                }
              />
              {authorization.role === "owner" &&
                review.status === "completed" && (
                  <ReviewDisclosureForm
                    attorneys={members
                      .filter(
                        (member) =>
                          member.role === "attorney" &&
                          member.status === "active",
                      )
                      .map((member) => ({ id: member.id, name: member.name }))}
                    caseId={caseId}
                    professionalReviewId={review.professionalReviewId}
                  />
                )}
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
