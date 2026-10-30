import Link from "next/link";
import type { ReactNode } from "react";

export function AuthShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-layout">
      <section className="auth-brand-panel" aria-label="Resurgo">
        <Link className="brand" href="/">
          Resurgo
        </Link>
        <div>
          <p className="eyebrow">Navigate today. Build tomorrow.</p>
          <h1>One place for every next step.</h1>
          <p>
            A private transition workspace, beginning with Atlanta-area divorce
            and property coordination.
          </p>
        </div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          {children}
        </div>
      </section>
    </main>
  );
}
