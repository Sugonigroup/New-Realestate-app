import { loadOne } from "@/lib/load";
import { ADMIN_NAV, Subnav } from "@/app/subnav";

interface Metric {
  metricCode: string;
  name: string;
  unit: string;
  period: string;
  valueNum: number;
  deltaPct: number | null;
  tone: string;
}

/** Latest KPI from GET /v1/platform/metrics/:code/latest. */
export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const m = code ? await loadOne<Metric>(`/v1/platform/metrics/${encodeURIComponent(code)}/latest`) : null;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Platform metrics</h1>
      <Subnav items={ADMIN_NAV} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Metric code</label>
          <input name="code" defaultValue={code ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      {m && (
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{m.name} · {m.period}</div>
          <div className="mt-1 text-2xl font-semibold">{m.valueNum} {m.unit}</div>
          <p className="mt-2 text-sm">
            delta {m.deltaPct ?? "—"}% · {m.tone}
          </p>
        </div>
      )}
      {code && !m && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No snapshot for this code.</p>}
    </main>
  );
}
