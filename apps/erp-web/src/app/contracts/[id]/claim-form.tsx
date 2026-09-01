"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function ClaimForm({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [claimNo, setNo] = useState("");
  const [raisedBy, setBy] = useState("internal");
  const [nature, setNature] = useState("delay_penalty");
  const [rupees, setRupees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/contracts/${contractId}/claims`, {
        claimNo, raisedBy, nature, amountPaise: rupeesToPaise(rupees),
      });
      setNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Claim no" value={claimNo} onChange={(e) => setNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={raisedBy} onChange={(e) => setBy(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        <option value="internal">internal</option>
        <option value="counterparty">counterparty</option>
      </select>
      <select value={nature} onChange={(e) => setNature(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["delay_penalty", "scope_change", "quality_defect", "payment_dispute", "force_majeure"].map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <input required inputMode="decimal" placeholder="Amount ₹" value={rupees} onChange={(e) => setRupees(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Raise claim"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
