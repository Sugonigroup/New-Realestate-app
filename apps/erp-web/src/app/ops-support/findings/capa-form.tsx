"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function CapaForm({ findingNo }: { findingNo: string }) {
  const router = useRouter();
  const [capaPlan, setPlan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/ops-support/findings/${encodeURIComponent(findingNo)}/capa`, { capaPlan });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input required placeholder="CAPA plan" value={capaPlan} onChange={(e) => setPlan(e.target.value)} className="w-40 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "CAPA"}
      </button>
      {error && <span className="text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
