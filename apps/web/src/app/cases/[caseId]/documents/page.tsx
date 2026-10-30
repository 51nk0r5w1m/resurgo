import {
  AuthorizationDeniedError,
  getAuthorizedCase,
  listAuthorizedDocuments,
} from "@resurgo/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DocumentUploadForm } from "../../../../components/document-upload-form";
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
  try {
    documents = await listAuthorizedDocuments(getDatabase(), {
      caseId,
      userId: session.user.id,
    });
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
        <section className="document-panel">
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
      </div>
    </main>
  );
}
