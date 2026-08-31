import { cookies } from "next/headers";
import { MoneyText, StatCard, filterNav, seededRolePermissions, AuthProvider, parseJwtClaims } from "@buildos/ui";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:8080";

/**
 * Executive cockpit v0 (D1 placeholder, 08 §D1): health strip + KPI tiles with
 * demo values from the seeded tenant. RSC shell; panels become independent
 * cache units as modules land (22 §2).
 */
export default async function DashboardPage() {
  const token = (await cookies()).get("access_token")?.value;
  const authHeaders = { authorization: `Bearer ${token ?? ""}` };
  let health: { status: string; checks: Record<string, string> } = { status: "unreachable", checks: {} };
  try {
    const res = await fetch(`${CORE_API}/v1/health`, { headers: authHeaders, cache: "no-store" });
    if (res.ok) health = (await res.json()) as typeof health;
  } catch {
    // degraded: dashboard still renders with placeholder data
  }

  // Live KPI aggregates from the CRM analytics endpoints
  const funnel = await fetch(`${CORE_API}/v1/crm/analytics/funnel`, { headers: authHeaders, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null) as null | { totalLeads: number; wonCount: number; winPct: number };
  const forecast = await fetch(`${CORE_API}/v1/crm/analytics/pipeline-forecast`, { headers: authHeaders, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null) as null | { openCount: number; grossPipelinePaise: string; weightedPipelinePaise: string; wonPaise: string };
  const visits = await fetch(`${CORE_API}/v1/crm/analytics/visit-funnel`, { headers: authHeaders, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null) as null | { completed: number; totalVisits: number; visitToOpportunityPct: number };
  const pendingRecs = await fetch(`${CORE_API}/v1/crm/ai/recommendations?status=pending`, { headers: authHeaders, cache: "no-store" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []) as unknown[];

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
          <StatCard label="Total Leads" value={funnel ? funnel.totalLeads : "—"} deltaPct={null} />
          <StatCard
            label="Weighted Pipeline"
            value={forecast ? <MoneyText paise={BigInt(forecast.weightedPipelinePaise ?? 0)} short /> : "—"}
            tone="success"
          />
          <StatCard
            label="Gross Pipeline"
            value={forecast ? <MoneyText paise={BigInt(forecast.grossPipelinePaise ?? 0)} short /> : "—"}
          />
          <StatCard
            label="Site Visits"
            value={visits ? `${visits.completed}/${visits.totalVisits}` : "—"}
            deltaPct={visits ? visits.visitToOpportunityPct : null}
            tone="success"
          />
          <StatCard label="Lead → Won" value={funnel ? `${funnel.winPct}%` : "—"} tone="success" />
          <StatCard
            label="AI Recommendations"
            value={Array.isArray(pendingRecs) ? pendingRecs.length : 0}
            tone={Array.isArray(pendingRecs) && pendingRecs.length > 0 ? "warning" : undefined}
          />
        </section>
        <p className="mt-8 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Live KPIs from CRM analytics · {" "}
          {forecast ? `${forecast.openCount} open opportunities · ` : ""}
          won pipeline {forecast ? <MoneyText paise={BigInt(forecast.wonPaise ?? 0)} short /> : "—"}.
        </p>
      </main>
    </div>
    </AuthProvider>
  );
}
