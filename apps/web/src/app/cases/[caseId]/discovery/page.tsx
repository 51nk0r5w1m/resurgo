import {
  atlantaDiscoveryQuestions,
  discoveryModules,
  getAuthorizedCase,
  getDiscoveryState,
  listAuthorizedDocuments,
} from "@resurgo/db";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
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
  let documents;
  try {
    [caseRecord, state, documents] = await Promise.all([
      getAuthorizedCase(getDatabase(), { caseId, userId: session.user.id }),
      getDiscoveryState(getDatabase(), { caseId, userId: session.user.id }),
      listAuthorizedDocuments(getDatabase(), {
        caseId,
        userId: session.user.id,
      }),
    ]);
  } catch {
    notFound();
  }
  if (!caseRecord || !state || !documents) notFound();
  const court =
    caseRecord.jurisdictionCode === "GA-FULTON-SUPERIOR"
      ? "Fulton County Superior Court"
      : caseRecord.jurisdictionCode === "GA-DEKALB-SUPERIOR"
        ? "DeKalb County Superior Court"
        : "Court information unavailable";
  return (
    <main className="case-page discovery-page">
      <CasePageHeader
        eyebrow={`Atlanta pilot · ${court}`}
        summary="A private, adaptive intake that saves each answer and turns applicable facts into explainable coordination steps."
        title="Let’s understand your situation."
      />
      <DiscoveryInterview
        caseId={caseId}
        documents={documents
          .filter(({ processing_status }) => processing_status === "available")
          .map((document) => ({
            title: document.title,
            versionId: document.version_id,
            versionNumber: document.version_number,
          }))}
        initialAnswers={state.answers}
        initialOutputs={state.outputs.map((output) => ({
          ...output,
          type: output.type as "document_request" | "review_trigger",
        }))}
        initialRecommendations={state.recommendations}
        initialRoadmap={state.roadmap}
        initialStatus={state.session.status}
        modules={[...discoveryModules]}
        questions={[...atlantaDiscoveryQuestions]}
      />
    </main>
  );
}
