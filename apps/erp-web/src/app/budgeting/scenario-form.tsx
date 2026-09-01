"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function ScenarioForm({ budgetId }: { budgetId: string }) {
  const router = useRouter();
  const [name, setName] = useState("Base");
  const [growthBps, setGrowth] = useState("0");
  const [inflationBps, setInfl] = useState("500");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/budgeting/budgets/${budgetId}/scenarios`, {
        name, growthBps: Number(growthBps), inflationBps: Number(inflationBps),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <input required placeholder="Scenario" value={name} onChange={(e) => setName(e.target.value)} className="w-28 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="numeric" placeholder="Growth bps" value={growthBps} onChange={(e) => setGrowth(e.target.value)} className="w-24 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="numeric" placeholder="Inflation bps" value={inflationBps} onChange={(e) => setInfl(e.target.value)} className="w-28 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Add scenario"}
      </button>
      {error && <span className="max-w-32 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
