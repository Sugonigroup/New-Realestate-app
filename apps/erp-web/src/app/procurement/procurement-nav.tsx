"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/procurement", label: "Dashboard", exact: true },
  { href: "/procurement/vendors", label: "Vendors" },
  { href: "/procurement/prs", label: "PRs" },
  { href: "/procurement/rfqs", label: "RFQs" },
  { href: "/procurement/pos", label: "POs" },
  { href: "/procurement/grns", label: "GRNs" },
  { href: "/procurement/ra-bills", label: "RA bills" },
] as const;

export function ProcurementNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-3 flex flex-wrap gap-1 text-sm">
      {LINKS.map((link) => {
        const active = "exact" in link && link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(link.href + "/");
        return (
          <Link
            key={link.href}
            href={link.href}
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

export function ToneChip({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const bg =
    tone === "success" ? "var(--bo-success)" : tone === "warning" ? "var(--bo-warning)" : tone === "danger" ? "var(--bo-danger)" : "var(--bo-bg)";
  const color = tone === "neutral" ? "var(--bo-text)" : "white";
  return (
    <span className="rounded px-2 py-0.5 text-xs font-medium capitalize" style={{ background: bg, color }}>
      {label.replaceAll("_", " ")}
    </span>
  );
}
