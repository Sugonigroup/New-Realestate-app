"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function SettleForm({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [rupees, setRupees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/contracts/claims/${claimId}/settle`, { settledPaise: rupeesToPaise(rupees) });
      setRupees("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input required inputMode="decimal" placeholder="Settle ₹" value={rupees} onChange={(e) => setRupees(e.target.value)} className="w-24 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Settle"}
      </button>
      {error && <span className="max-w-32 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
