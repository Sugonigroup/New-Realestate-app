"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

/** Receipt application: rupees input → paise; BR-K cash block is server-enforced. */
export default function ReceiptForm() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [rupees, setRupees] = useState("");
  const [instrument, setInstrument] = useState("gateway");
  const [ref, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/finance/receipts", {
        bookingId, unitId,
        amountPaise: String(Math.round(Number(rupees) * 100)),
        instrument, instrumentRef: ref || undefined,
      });
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 items-end gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
        placeholder="Booking ID" value={bookingId} onChange={(e) => setBookingId(e.target.value)} required />
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
        placeholder="Unit ID" value={unitId} onChange={(e) => setUnitId(e.target.value)} required />
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
        placeholder="Amount ₹" inputMode="decimal" value={rupees} onChange={(e) => setRupees(e.target.value)} required />
      <select value={instrument} onChange={(e) => setInstrument(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        <option value="gateway">Gateway (UPI/card)</option>
        <option value="neft">NEFT</option>
        <option value="rtgs">RTGS</option>
        <option value="nach">NACH</option>
        <option value="cheque">Cheque</option>
        <option value="cash">Cash (≤ ₹2,00,000)</option>
      </select>
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
        placeholder="UTR / cheque no (if any)" value={ref} onChange={(e) => setRef(e.target.value)} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Applying…" : "Apply receipt"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
