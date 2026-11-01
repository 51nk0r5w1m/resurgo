import { listAuthorizedCaseActivity } from "@resurgo/db";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
import { getAuth, getDatabase } from "../../../../lib/auth";
import { formatAction, formatRelativeDate } from "../../../../lib/presentation";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  const activity = await listAuthorizedCaseActivity(getDatabase(), {
    caseId,
    limit: 100,
    userId: session.user.id,
  }).catch(() => notFound());
  return (
    <main className="case-page">
      <CasePageHeader
        eyebrow="Case activity"
        summary="Security-sensitive actions are recorded without placing document contents or discovery answers in the log."
        title="A clear record of change"
      />
      <section className="workspace-card">
        {activity.length === 0 ? (
          <p className="empty-copy">Activity will appear as work begins.</p>
        ) : (
          <ol className="activity-list">
            {activity.map((event, index) => (
              <li key={`${event.occurredAt.toISOString()}-${index}`}>
                <span className="activity-mark" />
                <div>
                  <strong>{formatAction(event.action)}</strong>
                  <p>
                    {event.actorName ?? "Resurgo"} ·{" "}
                    {event.resourceType.replaceAll("_", " ")}
                  </p>
                  <small>
                    {formatRelativeDate(event.occurredAt)} · {event.outcome}
                  </small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
