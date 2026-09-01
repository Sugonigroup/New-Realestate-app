"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function CreateBudgetForm() {
  const router = useRouter();
  const [fiscalYear, setFy] = useState("FY27");
  const [title, setTitle] = useState("");
  const [costCenter, setCc] = useState("");
  const [accountCode, setAc] = useState("");
  const [period, setPeriod] = useState("2026-09");
  const [rupees, setRupees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/budgeting/budgets", {
        fiscalYear, title,
        lines: [{ costCenter, accountCode, period, amountPaise: rupeesToPaise(rupees) }],
      });
      setTitle("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Fiscal year" value={fiscalYear} onChange={(e) => setFy(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Cost center" value={costCenter} onChange={(e) => setCc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Account code" value={accountCode} onChange={(e) => setAc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Period YYYY-MM" value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Amount ₹" value={rupees} onChange={(e) => setRupees(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Create budget"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
