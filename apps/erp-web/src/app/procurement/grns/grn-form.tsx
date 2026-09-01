"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserApi } from "@/lib/api";

interface Line { id: string; materialName: string; qty: string | number; receivedQty: string | number }
interface Po { id: string; poNo: string; projectId: string; status: string; lines: Line[] }

export default function GrnForm({ orders }: { orders: Po[] }) {
  const router = useRouter();
  const open = orders.filter((o) => o.status === "open" || o.status === "partial");
  const [orderId, setOrderId] = useState(open[0]?.id ?? orders[0]?.id ?? "");
  const [grnNo, setGrnNo] = useState("");
  const [qty, setQty] = useState("");
  const [accepted, setAccepted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);
  const line = order?.lines?.[0];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order || !line) return;
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/procurement/grns", {
        grnNo,
        orderId: order.id,
        projectId: order.projectId,
        receivedAt: new Date().toISOString(),
        lines: [{ poLineId: line.id, qty: Number(qty), acceptedQty: Number(accepted) }],
      });
      setGrnNo("");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-5" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="GRN no" value={grnNo} onChange={(e) => setGrnNo(e.target.value)} />
      <select required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={orderId} onChange={(e) => setOrderId(e.target.value)}>
        {orders.length === 0 && <option value="">No POs</option>}
        {orders.map((o) => <option key={o.id} value={o.id}>{o.poNo} · {o.status}</option>)}
      </select>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder={line ? `Qty (line ${line.materialName})` : "Qty"} value={qty} onChange={(e) => setQty(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Accepted qty" value={accepted} onChange={(e) => setAccepted(e.target.value)} />
      <button type="submit" disabled={busy || !order || !line} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Posting…" : "Post GRN"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
