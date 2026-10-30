import {
  listAuthorizedCaseMembers,
  listAuthorizedDocuments,
  listAuthorizedProfessionalReviews,
  requireCaseAuthorization,
} from "@resurgo/db";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
import { ProfessionalReviewAction } from "../../../../components/professional-review-action";
import { ReviewAssignmentForm } from "../../../../components/review-assignment-form";
import { getAuth, getDatabase } from "../../../../lib/auth";

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  const [reviews, members, documents, authorization] = await Promise.all([
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
  ]).catch(() => notFound());
  return (
    <main className="case-page">
      <CasePageHeader
        eyebrow="Professional Review Register"
        summary="Each review remains tied to the exact evidence versions used. New evidence supersedes history rather than rewriting it."
        title="Accountable professional review"
      />
      <ReviewAssignmentForm
        caseId={caseId}
        documents={documents
          .filter(({ processing_status }) => processing_status === "available")
          .map((document) => ({
            id: document.document_id,
            title: document.title,
            versionId: document.version_id,
            versionNumber: document.version_number,
          }))}
        professionals={members
          .filter(
            (member) =>
              member.status === "active" &&
              [
                "attorney",
                "lender",
                "accountant",
                "mediator",
                "support_professional",
              ].includes(member.role),
          )
          .map((member) => ({
            id: member.id,
            name: member.name,
            role: member.role,
          }))}
      />
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
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
