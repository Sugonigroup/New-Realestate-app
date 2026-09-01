import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactElement, ReactNode } from "react";
import { AuthProvider, filterNav, parseJwtClaims, seededRolePermissions } from "@buildos/ui";

/** ERP chrome: role-filtered sidebar. Login (no token) renders children only. */
export async function ErpShell({ children }: { children: ReactNode }): Promise<ReactElement> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return <>{children}</>;

  const user = parseJwtClaims(token);
  const nav = filterNav(user?.roles ?? [], seededRolePermissions());

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-screen">
        <aside
          className="w-56 shrink-0 border-r p-4"
          style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
        >
          <div className="mb-6 text-lg font-semibold">BuildOS</div>
          <nav className="space-y-1 text-sm">
            {nav.map((item) =>
              item.href ? (
                <Link
                  key={item.key}
                  href={item.href}
                  className="block rounded px-3 py-2 hover:bg-zinc-100"
                  style={{ color: "var(--bo-text)" }}
                >
                  {item.label}
                </Link>
              ) : (
                <div key={item.key} className="rounded px-3 py-2" style={{ color: "var(--bo-text-muted)" }}>
                  {item.label}
                </div>
              ),
            )}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AuthProvider>
  );
}
