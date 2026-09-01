"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(raw: string): string {
  const n = raw.trim().replace(/,/g, "");
  const [r, f = ""] = n.split(".");
  return (BigInt(r || "0") * 100n + BigInt((f + "00").slice(0, 2))).toString();
}

export default function RaBillForm({ projects }: { projects: Array<{ id: string; code: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [contractorId, setContractorId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [billQty, setBillQty] = useState("");
  const [billRate, setBillRate] = useState("");
  const [mbQty, setMbQty] = useState("");
  const [boqQty, setBoqQty] = useState("");
  const [boqRate, setBoqRate] = useState("");
  const [cum, setCum] = useState("");
  const [soe, setSoe] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/procurement/ra-bills", {
        projectId, contractorId, billNo,
        billQty: Number(billQty),
        billRatePaise: rupeesToPaise(billRate),
        mbQty: Number(mbQty),
        boqQty: Number(boqQty),
        boqRatePaise: rupeesToPaise(boqRate),
        cumulativeBilledQty: Number(cum),
        soeQty: Number(soe),
      });
      setBillNo("");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <select required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
      </select>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Contractor id" value={contractorId} onChange={(e) => setContractorId(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Bill no" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Bill qty" value={billQty} onChange={(e) => setBillQty(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Bill rate ₹" value={billRate} onChange={(e) => setBillRate(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="MB qty" value={mbQty} onChange={(e) => setMbQty(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="BOQ qty" value={boqQty} onChange={(e) => setBoqQty(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="BOQ rate ₹" value={boqRate} onChange={(e) => setBoqRate(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Cumulative billed qty" value={cum} onChange={(e) => setCum(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="SOE qty" value={soe} onChange={(e) => setSoe(e.target.value)} />
      <button type="submit" disabled={busy || !projectId} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Submitting…" : "Submit RA bill"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
