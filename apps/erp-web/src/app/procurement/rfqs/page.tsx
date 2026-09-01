import { cookies } from "next/headers";
import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../procurement-nav";
import { CreateRfqForm } from "./rfq-forms";

interface Quote { id: string; vendorId: string; totalPaise: string; deliveryDays: number; status: string }
interface Rfq { id: string; rfqNo: string; status: string; requisitionId: string; quotes: Quote[] }
interface Pr { id: string; reqNo: string; status: string }

export default async function RfqsPage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let rfqs: Rfq[] = [];
  let prs: Pr[] = [];
  try { rfqs = (await api.get<Rfq[]>("/v1/procurement/rfqs")) ?? []; } catch { /* degraded */ }
  try { prs = (await api.get<Pr[]>("/v1/procurement/prs")) ?? []; } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">RFQs</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Quotes only on open RFQs. Open an RFQ to enter quotes, compare L1, and award a PO.
      </p>
      <CreateRfqForm prs={prs} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rfqs.map((r) => {
          const lowest = [...(r.quotes ?? [])].sort((a, b) => (BigInt(a.totalPaise) < BigInt(b.totalPaise) ? -1 : 1))[0];
          return (
            <Link key={r.id} href={`/procurement/rfqs/${r.id}`} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div>
                <div className="font-medium">{r.rfqNo} · {(r.quotes ?? []).length} quote(s)</div>
                {lowest && <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>L1 <MoneyText paise={BigInt(lowest.totalPaise)} /> · {lowest.deliveryDays}d</div>}
              </div>
              <ToneChip label={r.status} tone={r.status === "open" ? "warning" : r.status === "awarded" ? "success" : "neutral"} />
            </Link>
          );
        })}
        {rfqs.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No RFQs yet.</div>}
      </div>
    </main>
  );
}
