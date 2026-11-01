import type { ReactNode } from "react";

export function CasePageHeader({
  actions,
  eyebrow,
  summary,
  title,
}: {
  actions?: ReactNode;
  eyebrow: string;
  summary: string;
  title: string;
}) {
  return (
    <header className="case-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{summary}</p>
      </div>
      {actions && <div className="case-page-actions">{actions}</div>}
    </header>
  );
}
