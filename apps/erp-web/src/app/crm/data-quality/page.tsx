import { loadOne } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Scan {
  totalLeads: number;
  qualityScore: number;
  checks: Array<{ check: string; count: number; severity: string }>;
}

/** Data quality scan from GET /v1/crm/data-quality. */
export default async function DataQualityPage() {
  const scan = await loadOne<Scan>("/v1/crm/data-quality");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Lead data quality</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        {scan ? `Score ${scan.qualityScore} / 100 · ${scan.totalLeads} leads` : "Scan unavailable"}
      </p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(scan?.checks ?? []).map((c) => (
          <div key={c.check} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-medium">{c.check.replace(/_/g, " ")}</span>
            <div className="flex items-center gap-3">
              <span>{c.count}</span>
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{c.severity}</span>
            </div>
          </div>
        ))}
        {(!scan || scan.checks.length === 0) && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No checks.</div>}
      </div>
    </main>
  );
}
