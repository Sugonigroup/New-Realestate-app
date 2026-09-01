import ComputeForm from "./compute-form";
import { loadList } from "@/lib/load";
import { HR_NAV, Subnav } from "@/app/subnav";

interface PayrollRun {
  id: string;
  period: string;
  stateCode: string;
  status: string;
  totals: unknown;
}

/** Payroll runs from GET /v1/hr/payroll. */
export default async function PayrollPage() {
  const rows = await loadList<PayrollRun>("/v1/hr/payroll");

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Payroll</h1>
      <Subnav items={HR_NAV} />
      <ComputeForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{r.period} · {r.stateCode}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{typeof r.totals === "object" ? JSON.stringify(r.totals) : String(r.totals ?? "")}</div>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{r.status}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No payroll runs.</div>}
      </div>
    </main>
  );
}
