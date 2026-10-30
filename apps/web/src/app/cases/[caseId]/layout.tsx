import { getAuthorizedCase } from "@resurgo/db";
import { BrandMark } from "@resurgo/ui/brand-mark";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { CaseSidebar } from "../../../components/case-sidebar";
import { SignOutButton } from "../../../components/sign-out-button";
import { getAuth, getDatabase } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const courtNames: Record<string, string> = {
  "GA-DEKALB-SUPERIOR": "DeKalb County Superior Court",
  "GA-FULTON-SUPERIOR": "Fulton County Superior Court",
};

export default async function CaseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ caseId: string }>;
}) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { caseId } = await params;
  let caseRecord;
  try {
    caseRecord = await getAuthorizedCase(getDatabase(), {
      caseId,
      userId: session.user.id,
    });
  } catch {
    notFound();
  }
  if (!caseRecord) notFound();

  return (
    <div className="case-app-shell">
      <aside className="case-sidebar">
        <Link className="brand case-brand" href="/dashboard">
          <BrandMark className="case-brand-mark" />
          Resurgo
        </Link>
        <div className="case-context">
          <span>Atlanta pilot</span>
          <strong>{courtNames[caseRecord.jurisdictionCode]}</strong>
          <small>Private case</small>
        </div>
        <CaseSidebar caseId={caseId} />
        <div className="case-sidebar-foot">
          <Link href="/dashboard">All cases</Link>
          <Link href="/settings/security">Security</Link>
        </div>
      </aside>
      <div className="case-main-column">
        <header className="case-topbar">
          <div>
            <span className="status-dot" />
            Case workspace · {caseRecord.status}
          </div>
          <div className="case-user-menu">
            <span>{session.user.name}</span>
            <SignOutButton />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
