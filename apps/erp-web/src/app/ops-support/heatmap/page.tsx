import { loadOne } from "@/lib/load";
import { OPS_NAV, Subnav } from "@/app/subnav";

interface Heatmap {
  totalOpenRisks: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  topRisks: Array<{ id: string; riskNo: string; title: string; riskScore: number; category: string }>;
}

/** Open-risk heatmap from GET /v1/ops-support/risks/heatmap. */
export default async function RiskHeatmapPage() {
  const map = await loadOne<Heatmap>("/v1/ops-support/risks/heatmap");

  const bands = [
    { label: "Critical 15-25", n: map?.criticalCount ?? 0, color: "var(--bo-danger)" },
    { label: "High 10-14", n: map?.highCount ?? 0, color: "var(--bo-warning)" },
    { label: "Medium 5-9", n: map?.mediumCount ?? 0, color: "var(--bo-info)" },
    { label: "Low 1-4", n: map?.lowCount ?? 0, color: "var(--bo-success)" },
  ];

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Risk heatmap</h1>
      <Subnav items={OPS_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>{map?.totalOpenRisks ?? 0} open risks</p>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {bands.map((b) => (
          <div key={b.label} className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{b.label}</div>
            <div className="mt-1 text-2xl font-semibold" style={{ color: b.color }}>{b.n}</div>
          </div>
        ))}
      </div>
      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Top risks</h2>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(map?.topRisks ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-medium">{r.riskNo} · {r.title}</span>
            <span>{r.category} · {r.riskScore}</span>
          </div>
        ))}
        {(!map || map.topRisks.length === 0) && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No open risks.</div>}
      </div>
    </main>
  );
}
