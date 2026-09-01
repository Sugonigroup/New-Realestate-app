import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { PROCUREMENT_NAV, Subnav } from "@/app/subnav";
import AwardForm from "./award-form";
import QuoteForm from "./quote-form";

interface Comparison {
  rfqNo: string;
  quotes: Array<{
    rank: number;
    quoteId: string;
    vendorId: string;
    totalPaise: string;
    deliveryDays: number;
    savingsVsHighestPaise: string;
  }>;
}

/** L1 quote comparison from GET /v1/procurement/rfqs/:id/comparison. */
export default async function RfqComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cmp = await loadOne<Comparison>(`/v1/procurement/rfqs/${id}/comparison`);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">RFQ comparison {cmp?.rfqNo ?? ""}</h1>
      <Subnav items={PROCUREMENT_NAV} />
      <p className="mb-4 text-sm"><Link href="/procurement/rfqs" style={{ color: "var(--bo-primary)" }}>← RFQs</Link></p>
      <QuoteForm rfqId={id} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(cmp?.quotes ?? []).map((q) => (
          <div key={q.quoteId} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">L{q.rank} · vendor {q.vendorId.slice(0, 8)}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{q.deliveryDays} days delivery</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <MoneyText paise={asPaise(q.totalPaise)} />
              <span>save <MoneyText paise={asPaise(q.savingsVsHighestPaise)} /></span>
              {q.rank === 1 && <AwardForm rfqId={id} quoteId={q.quoteId} />}
            </div>
          </div>
        ))}
        {(!cmp || cmp.quotes.length === 0) && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No quotes yet.</div>}
      </div>
    </main>
  );
}
