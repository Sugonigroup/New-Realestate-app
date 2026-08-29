import { cookies } from "next/headers";
import { MoneyText, StatCard, filterNav, seededRolePermissions } from "@buildos/ui";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:8080";

/**
 * Executive cockpit v0 (D1 placeholder, 08 §D1): health strip + KPI tiles with
 * demo values from the seeded tenant. RSC shell; panels become independent
 * cache units as modules land (22 §2).
 */
export default async function DashboardPage() {
  const token = (await cookies()).get("access_token")?.value;
  let health: { status: string; checks: Record<string, string> } = { status: "unreachable", checks: {} };
  try {
    const res = await fetch(`${CORE_API}/v1/health`, {
      headers: { authorization: `Bearer ${token ?? ""}` },
      cache: "no-store",
    });
    if (res.ok) health = (await res.json()) as typeof health;
  } catch {
    // degraded: dashboard still renders with placeholder data
  }

  const roleCodes = decodeRoles(token);
  const nav = filterNav(roleCodes, seededRolePermissions());

  return (
    <div className="flex min-h-screen">
      <aside
        className="w-56 shrink-0 border-r p-4"
        style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
      >
        <div className="mb-6 text-lg font-semibold">BuildOS</div>
        <nav className="space-y-1 text-sm">
          {nav.map((item) => (
            <div key={item.key} className="rounded px-3 py-2" style={{ color: "var(--bo-text-muted)" }}>
              {item.label}
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <span
            className="rounded px-2 py-1 text-xs"
            style={{
              background: health.status === "ok" ? "var(--bo-success)" : "var(--bo-warning)",
              color: "white",
            }}
          >
            API: {health.status}
          </span>
        </header>
        <section className="flex flex-wrap gap-4">
          <StatCard label="Collections MTD" value={<MoneyText paise={4820000000n} short />} deltaPct={6.2} tone="success" />
          <StatCard label="Sales MTD" value={<MoneyText paise={6150000000n} short />} deltaPct={3.1} tone="success" />
          <StatCard label="Cash + Bank" value={<MoneyText paise={8340000000n} short />} />
          <StatCard label="Escrow Utilisation" value="61%" tone="warning" />
        </section>
        <p className="mt-8 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Phase 0 shell — modules light up per the roadmap: CRM + Sales (Phase 1), Finance +
          portals (Phase 2), Construction + Procurement (Phase 3).
        </p>
      </main>
    </div>
  );
}

/** WP-0D: role claims come from the verified session; presence-only decode for shell nav. */
function decodeRoles(token?: string): string[] {
  if (!token) return [];
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")) as { roles?: string[] };
    return json.roles ?? [];
  } catch {
    return [];
  }
}
