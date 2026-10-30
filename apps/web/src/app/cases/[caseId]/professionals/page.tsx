import { listAuthorizedCaseMembers } from "@resurgo/db";
import { ShieldCheck, UserRound } from "lucide-react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CasePageHeader } from "../../../../components/case-page-header";
import { getAuth, getDatabase } from "../../../../lib/auth";
import { formatRole } from "../../../../lib/presentation";

export default async function ProfessionalsPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  const members = await listAuthorizedCaseMembers(getDatabase(), {
    caseId,
    userId: session.user.id,
  }).catch(() => notFound());
  return (
    <main className="case-page">
      <CasePageHeader
        eyebrow="Professional team"
        summary="Case participation is explicit. Organization affiliation alone never grants access to this case or its documents."
        title="Your coordination team"
      />
      <section className="team-grid">
        {members.map((member) => (
          <article className="workspace-card team-card" key={member.id}>
            <div className="avatar-placeholder">
              <UserRound aria-hidden="true" />
            </div>
            <div>
              <p className="eyebrow">{formatRole(member.role)}</p>
              <h2>{member.name}</h2>
              <p>{member.organizationName ?? "Individual case participant"}</p>
            </div>
            <span className={`membership-state state-${member.status}`}>
              <ShieldCheck size={15} /> {member.status}
            </span>
          </article>
        ))}
      </section>
      {members.length === 1 && (
        <section className="workspace-card empty-state">
          <h2>Your case is private</h2>
          <p>
            No spouse or professional has been invited. Future invitations will
            require explicit case membership, and document access will still
            require separate consent and grants.
          </p>
        </section>
      )}
    </main>
  );
}
