"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { suffix: "", label: "Dashboard" },
  { suffix: "/qc", label: "QC / Pours" },
  { suffix: "/snags", label: "NCRs" },
  { suffix: "/hse", label: "HSE" },
  { suffix: "/drawings", label: "Drawings" },
  { suffix: "/approvals", label: "Approvals" },
  { suffix: "/certify", label: "Certify" },
] as const;

export function ProjectNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  return (
    <nav className="mt-3 flex flex-wrap gap-1 text-sm">
      {LINKS.map((link) => {
        const href = `${base}${link.suffix}`;
        const active = link.suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="rounded px-3 py-1.5"
            style={{
              background: active ? "var(--bo-primary)" : "transparent",
              color: active ? "white" : "var(--bo-text)",
              border: `1px solid ${active ? "var(--bo-primary)" : "var(--bo-border)"}`,
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const bg =
    tone === "success" ? "var(--bo-success)" : tone === "warning" ? "var(--bo-warning)" : tone === "danger" ? "var(--bo-danger)" : "var(--bo-bg)";
  const color = tone === "neutral" ? "var(--bo-text)" : "white";
  return (
    <span className="rounded px-2 py-0.5 text-xs font-medium capitalize" style={{ background: bg, color }}>
      {label}
    </span>
  );
}
