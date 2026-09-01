import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";

interface Item {
  costCenter: string;
  accountCode: string;
  budgetPaise: string;
  actualPaise: string;
  variancePaise: string;
  variancePct: number;
  alert: string;
}

interface Report {
  fiscalYear: string;
  period: string;
  totalBudgetPaise: string;
  totalActualPaise: string;
  totalVariancePaise: string;
  overallVariancePct: number;
  overallAlert: string;
  items: Item[];
}

/** Budget vs actual from GET /v1/budgeting/budgets/:id/variance?period=. */
export default async function VariancePage({
  searchParams,
}: {
  searchParams: Promise<{ budgetId?: string; period?: string }>;
}) {
  const { budgetId, period } = await searchParams;
  const report = budgetId && period
    ? await loadOne<Report>(`/v1/budgeting/budgets/${budgetId}/variance?period=${period}`)
    : null;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Budget variance</h1>
      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Budget ID</label>
          <input name="budgetId" defaultValue={budgetId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Period</label>
          <input name="period" defaultValue={period ?? "2026-09"} className="w-32 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      {report && (
        <>
          <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
            {report.fiscalYear} · {report.period} · {report.overallAlert} {report.overallVariancePct}%
          </p>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
            {report.items.map((i) => (
              <div key={`${i.costCenter}-${i.accountCode}`} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <span>{i.costCenter} · {i.accountCode}</span>
                <div className="flex gap-3 text-xs">
                  <span>bud <MoneyText paise={asPaise(i.budgetPaise)} /></span>
                  <span>act <MoneyText paise={asPaise(i.actualPaise)} /></span>
                  <span>{i.alert} {i.variancePct}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {budgetId && period && !report && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No variance for this period.</p>}
    </main>
  );
}
