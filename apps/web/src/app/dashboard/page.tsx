import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "../../components/sign-out-button";
import { CaseCreationForm } from "../../components/case-creation-form";
import { getAuth, getDatabase } from "../../lib/auth";
import { listAccessibleCases } from "@resurgo/db";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const cases = await listAccessibleCases(getDatabase(), session.user.id);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/">
          Resurgo
        </Link>
        <SignOutButton />
      </header>
      <section className="dashboard-hero">
        <p className="eyebrow">Private workspace</p>
        <h1>Welcome, {session.user.name}.</h1>
        <p>Start your transition without inviting or notifying a spouse.</p>
      </section>
      <section className="dashboard-grid">
        <article className="dashboard-card">
          <p className="eyebrow">Account security</p>
          <h2>Protect your sign-in</h2>
          <p>
            <Link href="/settings/security">
              Enroll an authenticator and save recovery codes.
            </Link>
          </p>
        </article>
        <article className="dashboard-card">
          <p className="eyebrow">Your next step</p>
          <h2>Create an Atlanta-area case</h2>
          <CaseCreationForm />
        </article>
        {cases.map((caseRecord) => (
          <article className="dashboard-card" key={caseRecord.id}>
            <p className="eyebrow">Private case · {caseRecord.status}</p>
            <h2>
              {caseRecord.jurisdictionCode === "GA-FULTON-SUPERIOR"
                ? "Fulton County"
                : "DeKalb County"}
            </h2>
            <p>
              <Link href={`/cases/${caseRecord.id}/discovery`}>
                Continue guided discovery
              </Link>
            </p>
          </article>
        ))}
        <article className="dashboard-card">
          <p className="eyebrow">Professional identity</p>
          <h2>Verification is separate</h2>
          <p>
            An account or organization affiliation never establishes verified
            professional status or case access.
          </p>
        </article>
      </section>
    </main>
  );
}
