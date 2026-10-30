import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MfaEnrollment } from "../../../components/mfa-enrollment";
import { getAuth } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Link className="brand" href="/dashboard">
          Resurgo
        </Link>
      </header>
      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="eyebrow">Account security</p>
          <h1>Two-step verification</h1>
          <p>
            Policy: MFA is strongly recommended for clients and required before
            professional access is activated. TOTP recovery uses one-time backup
            codes.
          </p>
          <MfaEnrollment />
        </div>
      </section>
    </main>
  );
}
