"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(raw: string): string {
  const n = raw.trim().replace(/,/g, "");
  const [r, f = ""] = n.split(".");
  return (BigInt(r || "0") * 100n + BigInt((f + "00").slice(0, 2))).toString();
}

export function RaisePrForm({ projects }: { projects: Array<{ id: string; code: string; name: string }> }) {
  const router = useRouter();
  const [reqNo, setReqNo] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [materialId, setMaterialId] = useState("cement-opc53");
  const [materialName, setMaterialName] = useState("OPC 53 Cement");
  const [unit, setUnit] = useState("bag");
  const [qty, setQty] = useState("1000");
  const [rate, setRate] = useState("350");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/procurement/prs", {
        reqNo, projectId,
        lines: [{ materialId, materialName, unit, qty: Number(qty), estRatePaise: rupeesToPaise(rate) }],
      });
      setReqNo("");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="PR no" value={reqNo} onChange={(e) => setReqNo(e.target.value)} />
      <select required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        {projects.length === 0 && <option value="">No projects</option>}
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
      </select>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Material id" value={materialId} onChange={(e) => setMaterialId(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Material name" value={materialName} onChange={(e) => setMaterialName(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Est. rate ₹" value={rate} onChange={(e) => setRate(e.target.value)} />
      <button type="submit" disabled={busy || !projectId} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Saving…" : "Raise PR"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}

export function ApprovePrButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true); setError(null);
    try {
      await browserApi().post(`/v1/procurement/prs/${id}/approve`, {});
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={busy} onClick={() => void approve()} className="rounded px-3 py-1 text-xs text-white" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Approve"}
      </button>
      {error && <span className="max-w-xs text-right text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </span>
  );
}
