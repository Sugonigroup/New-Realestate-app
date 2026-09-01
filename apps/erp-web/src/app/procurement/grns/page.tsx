import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../procurement-nav";
import GrnForm from "./grn-form";

interface GrnLine { qty: string | number; acceptedQty: string | number; rejectedQty: string | number }
interface Grn { id: string; grnNo: string; orderId: string; status: string; receivedAt: string; lines: GrnLine[] }
interface Po { id: string; poNo: string; projectId: string; status: string; lines: Array<{ id: string; materialName: string; qty: string | number; receivedQty: string | number }> }

export default async function GrnsPage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let grns: Grn[] = [];
  let orders: Po[] = [];
  try { grns = (await api.get<Grn[]>("/v1/procurement/grns")) ?? []; } catch { /* degraded */ }
  try { orders = (await api.get<Po[]>("/v1/procurement/orders")) ?? []; } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Goods receipts</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Posted GRNs are immutable. Qty cannot exceed outstanding PO balance.
      </p>
      <GrnForm orders={orders} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {grns.map((g) => {
          const acc = (g.lines ?? []).reduce((s, l) => s + Number(l.acceptedQty), 0);
          return (
            <div key={g.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div>
                <div className="font-medium">{g.grnNo}</div>
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  {new Date(g.receivedAt).toLocaleDateString("en-IN")} · accepted {acc}
                </div>
              </div>
              <ToneChip label={g.status} tone="success" />
            </div>
          );
        })}
        {grns.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No GRNs posted.</div>}
      </div>
    </main>
  );
}
