import {
  getAuthorizedCase,
  getDiscoveryState,
  listAuthorizedCaseActivity,
  listAuthorizedCaseMembers,
  listAuthorizedDocumentRequests,
  listAuthorizedDocuments,
  listAuthorizedProfessionalReviews,
} from "@resurgo/db";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  Users,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../components/case-page-header";
import { getAuth, getDatabase } from "../../../lib/auth";
import { formatAction, formatRelativeDate } from "../../../lib/presentation";

export default async function CaseOverviewPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  const [
    caseRecord,
    discovery,
    documents,
    requests,
    reviews,
    members,
    activity,
  ] = await Promise.all([
    getAuthorizedCase(getDatabase(), { caseId, userId: session.user.id }),
    getDiscoveryState(getDatabase(), { caseId, userId: session.user.id }),
    listAuthorizedDocuments(getDatabase(), { caseId, userId: session.user.id }),
    listAuthorizedDocumentRequests(getDatabase(), {
      caseId,
      userId: session.user.id,
    }),
    listAuthorizedProfessionalReviews(getDatabase(), {
      caseId,
      userId: session.user.id,
    }),
    listAuthorizedCaseMembers(getDatabase(), {
      caseId,
      userId: session.user.id,
    }),
    listAuthorizedCaseActivity(getDatabase(), {
      caseId,
      limit: 6,
      userId: session.user.id,
    }),
  ]).catch(() => notFound());
  if (!caseRecord || !discovery) notFound();
  const answers = Object.keys(discovery.answers).length;
  const openRequests = requests.filter(
    ({ status }) => status !== "completed" && status !== "cancelled",
  );
  const activeReviews = reviews.filter(
    ({ status }) => status !== "completed" && status !== "withdrawn",
  );
  const availableDocuments = documents.filter(
    ({ processing_status }) => processing_status === "available",
  );

  return (
    <main className="case-page">
      <CasePageHeader
        eyebrow="Case overview"
        summary="One place for every next step across discovery, documents, and professional coordination."
        title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${session.user.name.split(" ")[0]}.`}
      />
      <section aria-label="Case progress" className="case-metric-grid">
        <Link className="case-metric" href={`/cases/${caseId}/discovery`}>
          <CheckCircle2 aria-hidden="true" />
          <span>Discovery</span>
          <strong>
            {discovery.session.status === "completed"
              ? "Complete"
              : `${answers} answers saved`}
          </strong>
        </Link>
        <Link className="case-metric" href={`/cases/${caseId}/documents`}>
          <FileText aria-hidden="true" />
          <span>Documents</span>
          <strong>{availableDocuments.length} available</strong>
        </Link>
        <Link
          className="case-metric"
          href={`/cases/${caseId}/documents#requests`}
        >
          <Clock3 aria-hidden="true" />
          <span>Requests</span>
          <strong>{openRequests.length} outstanding</strong>
        </Link>
        <Link className="case-metric" href={`/cases/${caseId}/professionals`}>
          <Users aria-hidden="true" />
          <span>Case team</span>
          <strong>
            {members.length} participant{members.length === 1 ? "" : "s"}
          </strong>
        </Link>
      </section>
      <div className="overview-grid">
        <section className="workspace-card next-step-card">
          <p className="eyebrow">Next action</p>
          {discovery.session.status !== "completed" ? (
            <>
              <h2>Continue your discovery</h2>
              <p>
                Your saved answers will shape an explainable transition roadmap.
              </p>
              <Link className="text-action" href={`/cases/${caseId}/discovery`}>
                Continue discovery <ArrowRight size={16} />
              </Link>
            </>
          ) : openRequests.length > 0 ? (
            <>
              <h2>Review outstanding requests</h2>
              <p>{openRequests[0]?.title}</p>
              <Link
                className="text-action"
                href={`/cases/${caseId}/documents#requests`}
              >
                Open requests <ArrowRight size={16} />
              </Link>
            </>
          ) : activeReviews.length > 0 ? (
            <>
              <h2>Follow your active reviews</h2>
              <p>{activeReviews[0]?.decisionContext}</p>
              <Link className="text-action" href={`/cases/${caseId}/reviews`}>
                View reviews <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <h2>Add the documents that matter</h2>
              <p>
                Upload a PDF or DOCX into private quarantine for validation.
              </p>
              <Link className="text-action" href={`/cases/${caseId}/documents`}>
                Open documents <ArrowRight size={16} />
              </Link>
            </>
          )}
        </section>
        <section className="workspace-card">
          <div className="card-heading-row">
            <div>
              <p className="eyebrow">Recent activity</p>
              <h2>What changed</h2>
            </div>
            <Link href={`/cases/${caseId}/activity`}>View all</Link>
          </div>
          {activity.length === 0 ? (
            <p className="empty-copy">Activity will appear as work begins.</p>
          ) : (
            <ol className="activity-list compact">
              {activity.map((event, index) => (
                <li key={`${event.occurredAt.toISOString()}-${index}`}>
                  <span className="activity-mark" />
                  <div>
                    <strong>{formatAction(event.action)}</strong>
                    <small>
                      {event.actorName ?? "Resurgo"} ·{" "}
                      {formatRelativeDate(event.occurredAt)}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
