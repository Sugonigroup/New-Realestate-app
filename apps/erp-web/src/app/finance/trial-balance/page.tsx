import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import { FINANCE_NAV, Subnav } from "@/app/subnav";

interface TbRow {
  accountCode: string;
  debitPaise: string;
  creditPaise: string;
}

/** Trial balance from GET /v1/gl/trial-balance. */
export default async function TrialBalancePage() {
  const rows = await loadList<TbRow>("/v1/gl/trial-balance");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Trial balance</h1>
      <Subnav items={FINANCE_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.accountCode} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-mono">{r.accountCode}</span>
            <div className="flex gap-4">
              <span>Dr <MoneyText paise={asPaise(r.debitPaise)} /></span>
              <span>Cr <MoneyText paise={asPaise(r.creditPaise)} /></span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No posted journals.</div>}
      </div>
    </main>
  );
}
