import { getDiscoveryState } from "@resurgo/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
import { getAuth, getDatabase } from "../../../../lib/auth";

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  const state = await getDiscoveryState(getDatabase(), {
    caseId,
    userId: session.user.id,
  }).catch(() => notFound());
  return (
    <main className="case-page">
      <CasePageHeader
        eyebrow="Personalized roadmap"
        summary="Deterministic next steps based on your saved discovery answers. This is coordination guidance, not legal or mortgage advice."
        title="Your transition roadmap"
      />
      {state.session.status !== "completed" ? (
        <section className="workspace-card empty-state">
          <h2>Complete discovery to build your roadmap</h2>
          <p>
            Your answers are saved as you go and can be reviewed before
            completion.
          </p>
          <Link
            className="button button-primary"
            href={`/cases/${caseId}/discovery`}
          >
            Continue discovery
          </Link>
        </section>
      ) : (
        <ol className="workspace-roadmap">
          {state.roadmap.map((item, index) => (
            <li key={item.id}>
              <span>{index + 1}</span>
              <div>
                <small>{item.status}</small>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
