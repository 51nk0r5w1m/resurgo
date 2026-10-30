import {
  AuthorizationDeniedError,
  getAuthorizedCase,
  listAuthorizedDocumentRequests,
  listAuthorizedDocuments,
  listAuthorizedProfessionalReviews,
} from "@resurgo/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/dashboard">
          Resurgo
        </Link>
        <nav aria-label="Case navigation">
          <Link href={`/cases/${caseId}/discovery`}>Roadmap</Link>
          <Link aria-current="page" href={`/cases/${caseId}/documents`}>
            Documents
          </Link>
        </nav>
      </header>
      <section className="journey-header">
        <p className="eyebrow">Private case · Secure documents</p>
        <h1>Documents stay within their boundaries.</h1>
        <p>
          Upload a synthetic pilot document. Access remains case-scoped and each
          professional needs an explicit document grant and applicable consent.
        </p>
      </section>
      <div className="document-workspace">
        <section aria-label="Upload document" className="document-panel">
          <p className="eyebrow">New document</p>
          <h2>Upload to quarantine</h2>
          <DocumentUploadForm caseId={caseId} />
        </section>
        <section className="document-panel">
          <p className="eyebrow">Case library</p>
          <h2>Document versions</h2>
          {documents.length === 0 ? (
            <p>No documents have been added to this private case.</p>
          ) : (
            <ol className="document-list">
              {documents.map((document) => {
                const available = document.processing_status === "available";
                const resource = `/api/cases/${caseId}/documents/${document.document_id}/versions/${document.version_id}`;
                return (
                  <li key={document.document_id}>
                    <div>
                      <h3>{document.title}</h3>
                      <p>
                        {document.format.toUpperCase()} · Version{" "}
                        {document.version_number} ·{" "}
                        {document.confidentiality.replaceAll("_", " ")}
                      </p>
                    </div>
                    <span
                      className={`document-status status-${document.processing_status}`}
                    >
                      {document.processing_status.replaceAll("_", " ")}
                    </span>
                    {available && document.format === "pdf" && (
                      <Link href={`${resource}?preview=true`}>Preview</Link>
                    )}
                    {available && <Link href={resource}>Download</Link>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
        <section aria-label="Document requests" className="document-panel">
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
