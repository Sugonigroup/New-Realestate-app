"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function OfferForm({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [offerNo, setNo] = useState("");
  const [ctc, setCtc] = useState("");
  const [validUntil, setValid] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/hr/recruitment/offers", {
        offerNo, candidateId, offeredCtcPaise: rupeesToPaise(ctc),
        validUntil: new Date(validUntil).toISOString(),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input required placeholder="Offer no" value={offerNo} onChange={(e) => setNo(e.target.value)} className="w-24 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="CTC ₹" value={ctc} onChange={(e) => setCtc(e.target.value)} className="w-24 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <input required type="date" value={validUntil} onChange={(e) => setValid(e.target.value)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Offer"}
      </button>
      {error && <span className="max-w-32 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
