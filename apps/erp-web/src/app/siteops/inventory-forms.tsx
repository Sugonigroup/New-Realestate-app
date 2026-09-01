"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function InventoryForms({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [pid, setPid] = useState(projectId ?? "");
  const [materialId, setMaterialId] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [unit, setUnit] = useState("MT");
  const [qty, setQty] = useState("1");
  const [unitRupees, setUnitRupees] = useState("");
  const [refDocNo, setRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"in" | "out" | null>(null);

  async function post(kind: "in" | "out") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "in") {
        await browserApi().post("/v1/siteops/inventory/receipts", {
          projectId: pid, materialId, materialName, unit, qty: Number(qty),
          unitCostPaise: rupeesToPaise(unitRupees), refDocNo,
        });
      } else {
        await browserApi().post("/v1/siteops/inventory/issues", {
          projectId: pid, materialId, qty: Number(qty), refDocNo,
        });
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Project id" value={pid} onChange={(e) => setPid(e.target.value)} className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Material id" value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input placeholder="Material name (receipt)" value={materialName} onChange={(e) => setMaterialName(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input placeholder="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input inputMode="decimal" placeholder="Unit cost ₹ (receipt)" value={unitRupees} onChange={(e) => setUnitRupees(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Ref doc no" value={refDocNo} onChange={(e) => setRef(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="button" disabled={busy !== null} onClick={() => void post("in")} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy === "in" ? "…" : "Receive"}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => void post("out")} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy === "out" ? "…" : "Issue"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
