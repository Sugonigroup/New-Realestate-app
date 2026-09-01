"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function CreatePrForm() {
  const router = useRouter();
  const [reqNo, setReqNo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("MT");
  const [qty, setQty] = useState("1");
  const [rateRupees, setRateRupees] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/procurement/prs", {
        reqNo,
        projectId,
        requiredBy: requiredBy ? new Date(requiredBy).toISOString() : undefined,
        lines: [{
          materialId,
          materialName,
          unit,
          qty: Number(qty),
          estRatePaise: rupeesToPaise(rateRupees),
          remark: remark || undefined,
        }],
      });
      setReqNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="PR no" value={reqNo} onChange={(e) => setReqNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Project id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input type="date" placeholder="Required by" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Material id" value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Material name" value={materialName} onChange={(e) => setMaterialName(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Est. rate ₹" value={rateRupees} onChange={(e) => setRateRupees(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input placeholder="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Create PR"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
