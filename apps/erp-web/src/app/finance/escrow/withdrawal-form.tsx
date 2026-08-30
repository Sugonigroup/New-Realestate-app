"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

/** Withdrawal request — Form 3/4 certificate refs are mandatory (BR-A). */
export default function WithdrawalForm({ projectId, certifiedPct }: { projectId: string; certifiedPct: number }) {
  const router = useRouter();
  const [amountCr, setAmountCr] = useState("");
  const [form3, setForm3] = useState("");
  const [form4, setForm4] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setOk(null);
    try {
      await browserApi().post("/v1/finance/escrow/withdrawals", {
        projectId,
        amountPaise: String(Math.round(Number(amountCr) * 1e7)),
        form3Ref: form3, form4Ref: form4, certifiedPct,
      });
      setOk("Withdrawal requested — pending approval");
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 items-end gap-3 rounded-lg border p-4 md:grid-cols-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
        placeholder="Amount ₹ Cr" inputMode="decimal" value={amountCr} onChange={(e) => setAmountCr(e.target.value)} required />
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
        placeholder="Form 3 ref (engineer)" value={form3} onChange={(e) => setForm3(e.target.value)} required />
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
        placeholder="Form 4 ref (architect/CA)" value={form4} onChange={(e) => setForm4(e.target.value)} required />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Requesting…" : "Request withdrawal"}
      </button>
      {okMsg && <p className="col-span-full text-sm" style={{ color: "var(--bo-success)" }}>{okMsg}</p>}
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
