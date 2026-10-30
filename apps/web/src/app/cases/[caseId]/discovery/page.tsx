import {
  discoveryQuestions,
  getAuthorizedCase,
  getDiscoveryState,
} from "@resurgo/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { DiscoveryInterview } from "../../../../components/discovery-interview";
import { getAuth, getDatabase } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function DiscoveryPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  let caseRecord;
  let state;
  try {
    [caseRecord, state] = await Promise.all([
      getAuthorizedCase(getDatabase(), { caseId, userId: session.user.id }),
      getDiscoveryState(getDatabase(), { caseId, userId: session.user.id }),
    ]);
  } catch {
    notFound();
  }
  if (!caseRecord || !state) notFound();
  const court =
    caseRecord.jurisdictionCode === "GA-FULTON-SUPERIOR"
      ? "Fulton County Superior Court"
      : caseRecord.jurisdictionCode === "GA-DEKALB-SUPERIOR"
        ? "DeKalb County Superior Court"
        : "Court information unavailable";
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/dashboard">
          Resurgo
        </Link>
        <span>{court}</span>
      </header>
      <section className="journey-header">
        <p className="eyebrow">Atlanta pilot · Private case</p>
        <h1>Navigate today. Build tomorrow.</h1>
        <p>Your answers stay in this case and save as you go.</p>
      </section>
      <DiscoveryInterview
        caseId={caseId}
        initialAnswers={state.answers as Record<string, string>}
        initialRecommendations={state.recommendations}
        initialRoadmap={state.roadmap}
        questions={discoveryQuestions.map((question) => ({
          key: question.key,
          prompt: question.prompt,
          options: [...question.options],
        }))}
      />
    </main>
  );
}
