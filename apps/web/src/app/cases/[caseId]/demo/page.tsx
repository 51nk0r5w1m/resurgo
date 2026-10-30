import {
  getDiscoveryState,
  listAuthorizedCaseTasks,
  listAuthorizedDocuments,
  listAuthorizedProfessionalReviews,
  requireCaseAuthorization,
} from "@resurgo/db";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
import { getAuth, getDatabase } from "../../../../lib/auth";

export default async function DemoGuidePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  const authorization = await requireCaseAuthorization(getDatabase(), {
    caseId,
    operation: "read",
    userId: session.user.id,
  }).catch(() => notFound());
  const [documents, reviews, tasks, discovery] = await Promise.all([
    listAuthorizedDocuments(getDatabase(), { caseId, userId: session.user.id }),
    listAuthorizedProfessionalReviews(getDatabase(), {
      caseId,
      userId: session.user.id,
    }),
    listAuthorizedCaseTasks(getDatabase(), { caseId, userId: session.user.id }),
    authorization.role === "owner"
      ? getDiscoveryState(getDatabase(), { caseId, userId: session.user.id })
      : Promise.resolve(null),
  ]);
  const available = documents.filter(
    ({ processing_status }) => processing_status === "available",
  );
  const completedReviews = reviews.filter(
    ({ status }) => status === "completed",
  );
  const openTasks = tasks.filter(({ status }) => status === "open");

  const steps = [
    ...(discovery
      ? [
          {
            detail: `${Object.keys(discovery.answers).length} versioned answers across applicable Georgia modules`,
            href: `/cases/${caseId}/discovery`,
            label: "Completed guided discovery",
          },
          {
            detail: `${discovery.roadmap.length} explainable milestones and recommendations`,
            href: `/cases/${caseId}/roadmap`,
            label: "Personalized roadmap",
          },
        ]
      : []),
    {
      detail: `${available.length} authorized immutable document versions visible to this account`,
      href: `/cases/${caseId}/documents`,
      label: "Secure documents and version comparison",
    },
    {
      detail: `${completedReviews.length} completed review(s); source evidence remains separately authorized`,
      href: `/cases/${caseId}/reviews`,
      label: "Settlement Feasibility Review",
    },
    {
      detail: `${openTasks.length} unresolved next action(s) visible to this role`,
      href: `/cases/${caseId}`,
      label: "Outstanding conditions and next steps",
    },
    {
      detail:
        "Inspect purpose-specific grants and revoke document access immediately",
      href: `/cases/${caseId}/professionals`,
      label: "Client-controlled sharing",
    },
  ];

  return (
    <main className="case-page">
      <CasePageHeader
        eyebrow="Guided design-partner demonstration"
        summary="Follow one fictional Fulton County housing transition from discovery through lender findings and attorney acknowledgement."
        title="See the decision before the deadline becomes a problem."
      />
      <section className="workspace-card demo-scenario-card">
        <p className="eyebrow">Fictional scenario</p>
        <h2>A refinance is proposed within 90 days after the decree.</h2>
        <p>
          The mortgage specialist identifies unresolved qualification conditions
          and higher-rate payment risk. The attorney receives only the expressly
          disclosed findings before settlement terms are finalized. The client
          can see what remains unresolved and controls source-document access.
        </p>
      </section>
      <ol className="demo-guide-steps">
        {steps.map((step, index) => (
          <li className="workspace-card" key={step.label}>
            <span>{index + 1}</span>
            <div>
              <h2>{step.label}</h2>
              <p>{step.detail}</p>
              <Link className="text-action" href={step.href}>
                Open this workspace
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
