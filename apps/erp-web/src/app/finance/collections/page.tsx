import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import ReceiptForm from "./receipt-form";
import { FINANCE_NAV, Subnav } from "@/app/subnav";

interface Receipt {
  id: string;
  bookingId: string;
  amountPaise: string;
  instrument: string;
  status: string;
}

/** Collections (U2): receipt application with FIFO allocation preview. */
export default async function CollectionsPage() {
  const token = (await cookies()).get("access_token")?.value;
  let receipts: Receipt[] = [];
  try {
    receipts = (await serverApi(token).get<Receipt[]>("/v1/finance/receipts")) ?? [];
  } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Collections</h1>
      <Subnav items={FINANCE_NAV} />

      <ReceiptForm />

      <h2 className="mb-2 mt-8 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>
        Recent receipts
      </h2>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {receipts.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <span className="font-medium">{r.instrument}</span>
              <span className="ml-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>{r.bookingId.slice(0, 8)}…</span>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={BigInt(r.amountPaise)} />
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{r.status}</span>
            </div>
          </div>
        ))}
        {receipts.length === 0 && (
          <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No receipts.</div>
        )}
      </div>
    </main>
  );
}
