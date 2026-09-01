"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

/** Draft payroll run for a period and state. */
export default function ComputeForm() {
  const router = useRouter();
  const [period, setPeriod] = useState("2026-08");
  const [stateCode, setState] = useState("KA");
  const [days, setDays] = useState("31");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/hr/payroll/compute", {
        period, stateCode, daysInMonth: Number(days),
      });
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="mb-6 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Period</label>
        <input className="w-32 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          value={period} onChange={(e) => setPeriod(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>State</label>
        <select className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          value={stateCode} onChange={(e) => setState(e.target.value)}>
          {["KA", "MH", "TN", "TG", "UP"].map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Days</label>
        <input type="number" min={28} max={31} className="w-20 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          value={days} onChange={(e) => setDays(e.target.value)} />
      </div>
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Computing…" : "Compute run"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
