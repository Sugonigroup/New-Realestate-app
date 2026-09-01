import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { FINANCE_NAV, Subnav } from "@/app/subnav";

interface Proposal {
  proposals: Array<{ invoiceId: string; vendorId: string; amountPaise: string }>;
  totalPaise: string;
}

/** AP payment proposal from GET /v1/gl/ap/payment-proposal. */
export default async function ApRunPage() {
  const run = await loadOne<Proposal>("/v1/gl/ap/payment-proposal");
  const rows = run?.proposals ?? [];

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">AP payment run</h1>
      <Subnav items={FINANCE_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        3-way matched invoices · total {run ? <MoneyText paise={asPaise(run.totalPaise)} /> : "—"}
      </p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.invoiceId} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-mono text-xs">{r.invoiceId.slice(0, 8)}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>vendor {r.vendorId.slice(0, 8)}</div>
            </div>
            <MoneyText paise={asPaise(r.amountPaise)} />
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No matched invoices.</div>}
      </div>
    </main>
  );
}
