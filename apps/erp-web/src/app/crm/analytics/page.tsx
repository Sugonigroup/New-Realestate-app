import { MoneyText } from "@buildos/ui";
import { asPaise, loadList, loadOne } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Funnel {
  totalLeads: number;
  wonCount: number;
  winPct: number;
  stages: Array<{ stage: string; reached: number; conversionFromPrevPct: number | null }>;
}

interface SourceRow {
  source: string;
  leads: number;
  qualified: number;
  won: number;
  leadToWonPct: number;
}

interface RepRow {
  userId: string;
  leads: number;
  responded: number;
  slaCompliancePct: number | null;
  wonValuePaise: string;
}

interface Aging {
  openCount: number;
  avgAgeDays: number;
  buckets: { fresh: number; week: number; twoWeeks: number; month: number; aged: number };
}

/** Funnel / source / rep analytics plus opportunity aging. */
export default async function CrmAnalyticsPage() {
  const [funnel, sources, reps, aging] = await Promise.all([
    loadOne<Funnel>("/v1/crm/analytics/funnel"),
    loadList<SourceRow>("/v1/crm/analytics/sources"),
    loadList<RepRow>("/v1/crm/analytics/reps"),
    loadOne<Aging>("/v1/crm/analytics/opportunity-aging"),
  ]);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">CRM analytics</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        {funnel ? `${funnel.totalLeads} leads · ${funnel.wonCount} won (${funnel.winPct}%)` : "No funnel data"}
        {aging ? ` · ${aging.openCount} open opps, avg age ${aging.avgAgeDays}d` : ""}
      </p>

      {aging && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {([
            ["<=3d", aging.buckets.fresh],
            ["4-7d", aging.buckets.week],
            ["8-14d", aging.buckets.twoWeeks],
            ["15-30d", aging.buckets.month],
            [">30d", aging.buckets.aged],
          ] as const).map(([label, n]) => (
            <div key={label} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{label}</div>
              <div className="text-lg font-semibold">{n}</div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Funnel</h2>
      <div className="mb-8 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(funnel?.stages ?? []).map((s) => (
          <div key={s.stage} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-medium">{s.stage.replace(/_/g, " ")}</span>
            <span>{s.reached}{s.conversionFromPrevPct != null ? ` · ${s.conversionFromPrevPct}% from prev` : ""}</span>
          </div>
        ))}
        {(!funnel || funnel.stages.length === 0) && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No stages.</div>}
      </div>

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Sources</h2>
      <div className="mb-8 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {sources.map((s) => (
          <div key={s.source} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-medium">{s.source}</span>
            <span>{s.leads} leads · {s.qualified} qualified · {s.won} won ({s.leadToWonPct}%)</span>
          </div>
        ))}
        {sources.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No sources.</div>}
      </div>

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Reps</h2>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {reps.map((r) => (
          <div key={r.userId} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-mono text-xs">{r.userId.slice(0, 8)}</span>
            <div className="flex items-center gap-3">
              <span>{r.leads} leads · SLA {r.slaCompliancePct ?? "—"}%</span>
              <MoneyText paise={asPaise(r.wonValuePaise)} />
            </div>
          </div>
        ))}
        {reps.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No assigned reps.</div>}
      </div>
    </main>
  );
}
