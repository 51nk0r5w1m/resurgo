"use client";

import {
  Activity,
  BookOpenCheck,
  Compass,
  FileText,
  LayoutDashboard,
  Map,
  MessageSquareText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "", icon: LayoutDashboard, label: "Overview" },
  { href: "/demo", icon: BookOpenCheck, label: "Demo guide" },
  { href: "/discovery", icon: Compass, label: "Discovery" },
  { href: "/roadmap", icon: Map, label: "Roadmap" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/professionals", icon: Users, label: "Professional team" },
  { href: "/reviews", icon: MessageSquareText, label: "Reviews" },
  { href: "/activity", icon: Activity, label: "Activity" },
] as const;

export function CaseSidebar({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  const root = `/cases/${caseId}`;

  return (
    <nav aria-label="Case workspace" className="case-sidebar-nav">
      {items.map(({ href, icon: Icon, label }) => {
        const destination = `${root}${href}`;
        const active =
          href === "" ? pathname === root : pathname.startsWith(destination);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={active ? "is-active" : undefined}
            href={destination}
            key={label}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
