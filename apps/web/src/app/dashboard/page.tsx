import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "../../components/sign-out-button";
import { getAuth } from "../../lib/auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

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
          <p>
            Case creation will be enabled after the authorization security gate
            passes.
          </p>
        </article>
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
