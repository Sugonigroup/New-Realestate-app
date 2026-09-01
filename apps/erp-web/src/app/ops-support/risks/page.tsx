import { loadList } from "@/lib/load";
import { OPS_NAV, Subnav } from "@/app/subnav";
import RaiseRiskForm from "./raise-form";

interface Risk {
  id: string;
  riskNo: string;
  title: string;
  category: string;
  probability: number;
  impact: number;
  riskScore: number;
  ownerRole: string;
  status: string;
}

/** Risk register from GET /v1/ops-support/risks. */
export default async function RisksPage() {
  const rows = await loadList<Risk>("/v1/ops-support/risks");

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Risk register</h1>
      <Subnav items={OPS_NAV} />
      <RaiseRiskForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{r.riskNo} · {r.title}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {r.category} · P{r.probability}×I{r.impact} · {r.ownerRole}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{r.riskScore}</span>
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{r.status}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No risks.</div>}
      </div>
    </main>
  );
}
