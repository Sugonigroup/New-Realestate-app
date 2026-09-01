import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import { FINANCE_NAV, Subnav } from "@/app/subnav";

interface LedgerRow {
  id: string;
  entryType: string;
  debitPaise: string;
  creditPaise: string;
  createdAt: string;
}

/** Customer ledger from GET /v1/finance/ledger?unitId=. */
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ unitId?: string }>;
}) {
  const { unitId } = await searchParams;
  const rows = unitId ? await loadList<LedgerRow>(`/v1/finance/ledger?unitId=${unitId}`) : [];

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Customer ledger</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/finance/demands" style={{ color: "var(--bo-primary)" }}>Demands →</Link>
          <Link href="/finance/collections" style={{ color: "var(--bo-primary)" }}>Collections →</Link>
        </div>
      </div>
      <Subnav items={FINANCE_NAV} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Unit ID</label>
          <input name="unitId" defaultValue={unitId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      {unitId && (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div>
                <div className="font-medium">{r.entryType}</div>
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{new Date(r.createdAt).toLocaleString("en-IN")}</div>
              </div>
              <div className="text-right text-xs">
                <div>Dr <MoneyText paise={asPaise(r.debitPaise)} /></div>
                <div>Cr <MoneyText paise={asPaise(r.creditPaise)} /></div>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No ledger entries.</div>}
        </div>
      )}
    </main>
  );
}
