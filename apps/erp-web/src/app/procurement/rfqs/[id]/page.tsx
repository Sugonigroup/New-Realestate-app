import { cookies } from "next/headers";
import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../../procurement-nav";
import { AwardForm, QuoteForm } from "./quote-award-forms";

interface Line { materialId: string; materialName: string; unit: string; qty: string | number }
interface Quote { id: string; vendorId: string; totalPaise: string; deliveryDays: number; status: string }
interface Rfq { id: string; rfqNo: string; status: string; lines: Line[]; quotes: Quote[] }
interface Cmp { quotes: Array<{ rank: number; quoteId: string; vendorId: string; totalPaise: string; deliveryDays: number; savingsVsHighestPaise: string }> }
interface Vendor { id: string; code: string; name: string }
interface Project { id: string; code: string }

export default async function RfqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let rfq: Rfq | null = null;
  let cmp: Cmp | null = null;
  let vendors: Vendor[] = [];
  let projects: Project[] = [];
  try { rfq = await api.get<Rfq>(`/v1/procurement/rfqs/${id}`); } catch { /* degraded */ }
  try { cmp = await api.get<Cmp>(`/v1/procurement/rfqs/${id}/comparison`); } catch { /* no quotes yet */ }
  try { vendors = (await api.get<Vendor[]>("/v1/procurement/vendors")) ?? []; } catch { /* degraded */ }
  try { projects = (await api.get<Project[]>("/v1/projects")) ?? []; } catch { /* degraded */ }

  if (!rfq) {
    return <main className="p-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>RFQ not found.</main>;
  }

  return (
    <main className="p-6">
      <p className="mb-2 text-sm"><Link href="/procurement/rfqs" style={{ color: "var(--bo-primary)" }}>RFQs</Link></p>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">{rfq.rfqNo}</h2>
        <ToneChip label={rfq.status} tone={rfq.status === "open" ? "warning" : "success"} />
      </div>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        {(rfq.lines ?? []).map((l) => `${l.materialName} ${l.qty} ${l.unit}`).join(" · ") || "No lines"}
      </p>

      {rfq.status === "open" && <QuoteForm rfqId={rfq.id} vendors={vendors} lines={rfq.lines ?? []} />}

      <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>L1 comparison</h3>
      <div className="mb-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(cmp?.quotes ?? []).map((q) => (
          <div key={q.quoteId} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">L{q.rank} · vendor {q.vendorId.slice(0, 8)}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{q.deliveryDays} days · save <MoneyText paise={BigInt(q.savingsVsHighestPaise)} /></div>
            </div>
            <MoneyText paise={BigInt(q.totalPaise)} />
          </div>
        ))}
        {(!cmp || cmp.quotes.length === 0) && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No quotes to rank yet.</div>}
      </div>

      {rfq.status === "open" && (cmp?.quotes.length ?? 0) > 0 && (
        <AwardForm rfqId={rfq.id} quotes={cmp!.quotes} projects={projects} />
      )}
    </main>
  );
}
