import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../procurement-nav";

interface Line { id: string; materialName: string; qty: string | number; receivedQty: string | number; ratePaise: string }
interface Po {
  id: string;
  poNo: string;
  vendorId: string | null;
  status: string;
  totalPaise: string;
  receivedInFull: boolean;
  promisedDate: string | null;
  lines: Line[];
}

export default async function PurchaseOrdersPage() {
  const token = (await cookies()).get("access_token")?.value;
  let orders: Po[] = [];
  try { orders = (await serverApi(token).get<Po[]>("/v1/procurement/orders")) ?? []; } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Purchase orders</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Awarded from RFQ. PO-0001 Verde cement stays at 24.5 Cr paise. Receive against lines on GRNs.
      </p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{o.poNo} · {(o.lines ?? []).length} line(s)</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                vendor {o.vendorId ? o.vendorId.slice(0, 8) : "unassigned"} · received in full {o.receivedInFull ? "yes" : "no"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={BigInt(o.totalPaise ?? "0")} />
              <ToneChip label={o.status} tone={o.status === "received" ? "success" : o.status === "partial" ? "warning" : "neutral"} />
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No purchase orders.</div>}
      </div>
    </main>
  );
}
