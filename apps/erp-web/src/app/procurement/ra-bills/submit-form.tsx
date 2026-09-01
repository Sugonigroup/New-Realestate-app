"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function SubmitRaBillForm({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [billNo, setBillNo] = useState("");
  const [pid, setPid] = useState(projectId ?? "");
  const [contractorId, setContractor] = useState("");
  const [billQty, setBillQty] = useState("1");
  const [billRate, setBillRate] = useState("");
  const [mbQty, setMbQty] = useState("1");
  const [boqQty, setBoqQty] = useState("1");
  const [boqRate, setBoqRate] = useState("");
  const [cumQty, setCumQty] = useState("1");
  const [soeQty, setSoeQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/procurement/ra-bills", {
        projectId: pid,
        contractorId,
        billNo,
        billQty: Number(billQty),
        billRatePaise: rupeesToPaise(billRate),
        mbQty: Number(mbQty),
        boqQty: Number(boqQty),
        boqRatePaise: rupeesToPaise(boqRate),
        cumulativeBilledQty: Number(cumQty),
        soeQty: Number(soeQty),
      });
      setBillNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid max-w-3xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Bill no" value={billNo} onChange={(e) => setBillNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Project id" value={pid} onChange={(e) => setPid(e.target.value)} className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Contractor id" value={contractorId} onChange={(e) => setContractor(e.target.value)} className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Bill qty" value={billQty} onChange={(e) => setBillQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Bill rate ₹" value={billRate} onChange={(e) => setBillRate(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="MB qty" value={mbQty} onChange={(e) => setMbQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="BOQ qty" value={boqQty} onChange={(e) => setBoqQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="BOQ rate ₹" value={boqRate} onChange={(e) => setBoqRate(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Cumulative billed qty" value={cumQty} onChange={(e) => setCumQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="SOE qty" value={soeQty} onChange={(e) => setSoeQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Submitting…" : "Submit RA bill"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
