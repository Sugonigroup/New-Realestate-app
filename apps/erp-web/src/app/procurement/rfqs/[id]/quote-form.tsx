"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function QuoteForm({ rfqId }: { rfqId: string }) {
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("7");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("1");
  const [rateRupees, setRateRupees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/procurement/rfqs/${rfqId}/quotes`, {
        vendorId,
        deliveryDays: Number(deliveryDays),
        lines: [{ materialId, qty: Number(qty), ratePaise: rupeesToPaise(rateRupees) }],
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Vendor id" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="numeric" placeholder="Delivery days" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Material id" value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Rate ₹" value={rateRupees} onChange={(e) => setRateRupees(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Receive quote"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
