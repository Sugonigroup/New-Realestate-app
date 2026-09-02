"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@buildos/ui";

/** App shell sidebar — client component for active-route highlighting. */
export function Shell({ nav, children }: { nav: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside
        className="w-56 shrink-0 border-r p-4"
        style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
      >
        <div className="mb-6 text-lg font-semibold">BuildOS</div>
        <nav className="space-y-0.5 text-sm">
          {nav.map((item) => {
            const active = item.href ? (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) : false;
            return item.href ? (
              <Link
                key={item.key}
                href={item.href}
                className="block rounded px-3 py-1.5 transition"
                style={
                  active
                    ? { background: "var(--bo-primary)", color: "white" }
                    : { color: "var(--bo-text-muted)" }
                }
              >
                {item.label}
              </Link>
            ) : (
              <div key={item.key} className="rounded px-3 py-1.5" style={{ color: "var(--bo-text-muted)" }}>
                {item.label}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
