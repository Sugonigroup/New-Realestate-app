"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/finance", label: "Dashboard", exact: true },
  { href: "/finance/coa", label: "Chart of accounts" },
  { href: "/finance/gl", label: "General ledger" },
  { href: "/finance/journals", label: "Journals" },
  { href: "/finance/trial-balance", label: "Trial balance" },
  { href: "/finance/ap", label: "AP" },
  { href: "/finance/ar", label: "AR aging" },
  { href: "/finance/bank", label: "Bank" },
  { href: "/finance/periods", label: "Periods" },
  { href: "/finance/audit", label: "Audit" },
  { href: "/finance/demands", label: "Demands" },
  { href: "/finance/collections", label: "Collections" },
  { href: "/finance/escrow", label: "Escrow" },
  { href: "/finance/ledger", label: "Ledger" },
] as const;

export function FinanceNav() {
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
