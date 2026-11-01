import {
  AuthorizationDeniedError,
  getAuthorizedDocumentDetail,
} from "@resurgo/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ArchiveDocumentButton } from "../../../../../components/archive-document-button";
import { DocumentReviewWorkspace } from "../../../../../components/document-review-workspace";
import { getAuth, getDatabase } from "../../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ caseId: string; documentId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const identifiers = await params;
  let detail;
  try {
    detail = await getAuthorizedDocumentDetail(getDatabase(), {
      ...identifiers,
      userId: session.user.id,
    });
  } catch (error) {
    if (error instanceof AuthorizationDeniedError) notFound();
    throw error;
  }
  const latest = detail.versions[0];
  if (!latest) notFound();
  return (
    <main className="case-page document-detail-page">
      <div className="document-breadcrumb">
        <Link href={`/cases/${identifiers.caseId}/documents`}>Documents</Link>
        <span aria-hidden="true">›</span>
        <span>{detail.document.title}</span>
      </div>
      <header className="document-detail-header">
        <div>
          <p className="eyebrow">
            {detail.document.classification.replaceAll("_", " ")} ·{" "}
            {detail.document.format.toUpperCase()}
          </p>
          <h1>{detail.document.title}</h1>
          <p>
            Version {latest.version_number} ·{" "}
            {detail.document.confidentiality.replaceAll("_", " ")} ·{" "}
            {(latest.byte_size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <div className="document-detail-actions">
          <span
            className={`document-status status-${latest.processing_status}`}
          >
            {latest.processing_status.replaceAll("_", " ")}
          </span>
          <ArchiveDocumentButton
            caseId={identifiers.caseId}
            documentId={identifiers.documentId}
          />
        </div>
      </header>
      <DocumentReviewWorkspace
        caseId={identifiers.caseId}
        comments={detail.comments}
        documentId={identifiers.documentId}
        format={detail.document.format}
        title={detail.document.title}
        versions={detail.versions}
      />
    </main>
  );
}
