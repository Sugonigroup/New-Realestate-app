"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function MeterForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [meterVal, setVal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/assets/${assetId}/meter`, { meterVal: Number(meterVal) });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-wrap items-center gap-2">
      <input required inputMode="decimal" placeholder="Meter reading" value={meterVal} onChange={(e) => setVal(e.target.value)} className="w-36 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Record meter"}
      </button>
      {error && <span className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
