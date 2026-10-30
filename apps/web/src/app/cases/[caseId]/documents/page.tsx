import {
  AuthorizationDeniedError,
  getAuthorizedCase,
  listAuthorizedDocumentRequests,
  listAuthorizedDocuments,
  listAuthorizedProfessionalReviews,
} from "@resurgo/db";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
import { DocumentLibrary } from "../../../../components/document-library";
import { DocumentUploadForm } from "../../../../components/document-upload-form";
import { DocumentRequestAction } from "../../../../components/document-request-action";
import { DocumentRequestForm } from "../../../../components/document-request-form";
import { getAuth, getDatabase } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  try {
    await getAuthorizedCase(getDatabase(), {
      caseId,
      userId: session.user.id,
    });
  } catch {
    notFound();
  }
  let documents;
  let documentRequests;
  let professionalReviews;
  try {
    [documents, documentRequests, professionalReviews] = await Promise.all([
      listAuthorizedDocuments(getDatabase(), {
        caseId,
        userId: session.user.id,
      }),
      listAuthorizedDocumentRequests(getDatabase(), {
        caseId,
        userId: session.user.id,
      }),
      listAuthorizedProfessionalReviews(getDatabase(), {
        caseId,
        userId: session.user.id,
      }),
    ]);
  } catch (error) {
    if (error instanceof AuthorizationDeniedError) notFound();
    throw error;
  }

  return (
    <main className="case-page document-page">
      <CasePageHeader
        eyebrow="Secure documents"
        summary="Upload, organize, review, and version your case records. Files remain private and unavailable until security processing completes."
        title="Documents"
      />
      <div className="document-workspace">
        <section className="document-panel document-library-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Private case library</p>
              <h2>Your documents</h2>
            </div>
            <span>{documents.length} records</span>
          </div>
          <DocumentLibrary caseId={caseId} documents={documents} />
        </section>
        <section
          aria-label="Upload document"
          className="document-panel upload-panel"
        >
          <p className="eyebrow">Add documents</p>
          <h2>Upload securely</h2>
          <p>
            Originals are retained as immutable versions. A replacement creates
            a new version and never overwrites the prior file.
          </p>
          <DocumentUploadForm caseId={caseId} />
        </section>
        <section
          aria-label="Document requests"
          className="document-panel request-panel"
          id="requests"
        >
          <p className="eyebrow">Document requests</p>
          <h2>Track what is still needed</h2>
          <DocumentRequestForm caseId={caseId} />
          {documentRequests.length === 0 ? (
            <p>No document requests are open for this case.</p>
          ) : (
            <ol className="document-list request-list">
              {documentRequests.map((request) => (
                <li key={request.document_request_id}>
                  <div>
                    <h3>{request.title}</h3>
                    <p>{request.description}</p>
                  </div>
                  <span className="document-status">{request.status}</span>
                  <DocumentRequestAction
                    availableVersions={documents
                      .filter(
                        (document) =>
                          document.processing_status === "available",
                      )
                      .map((document) => ({
                        documentId: document.document_id,
                        title: document.title,
                        versionId: document.version_id,
                        versionNumber: document.version_number,
                      }))}
                    caseId={caseId}
                    linkedDocumentId={request.document_id}
                    linkedVersionId={request.document_version_id}
                    requestId={request.document_request_id}
                    status={request.status}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="document-panel review-register">
          <p className="eyebrow">Professional Review Register</p>
          <h2>Evidence and accountable decisions</h2>
          <p>
            Reviews remain linked to exact document versions. A newer version
            supersedes the affected review instead of rewriting its history.
          </p>
          {professionalReviews.length === 0 ? (
            <p>No professional reviews have been authorized for this case.</p>
          ) : (
            <ol className="review-list">
              {professionalReviews.map((review) => (
                <li key={review.professionalReviewId}>
                  <div className="review-heading">
                    <div>
                      <h3>{review.decisionContext}</h3>
                      <p>
                        {review.professionalName} ·{" "}
                        {review.subjectType.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span className="document-status">
                      {review.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <p>{review.reviewScope}</p>
                  {review.evidence.length > 0 && (
                    <ul>
                      {review.evidence.map((evidence) => (
                        <li key={evidence.documentVersionId}>
                          {evidence.title} · version {evidence.versionNumber} —{" "}
                          {evidence.purpose}
                        </li>
                      ))}
                    </ul>
                  )}
                  {review.statements.length > 0 && (
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
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
