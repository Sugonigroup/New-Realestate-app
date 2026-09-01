"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function WorkOrderForm({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [woNo, setNo] = useState("");
  const [type, setType] = useState("preventive");
  const [description, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/assets/work-orders", { woNo, assetId, type, description });
      setNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3">
      <input required placeholder="WO no" value={woNo} onChange={(e) => setNo(e.target.value)} className="w-28 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["preventive", "corrective", "breakdown", "inspection"].map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input required placeholder="Description" value={description} onChange={(e) => setDesc(e.target.value)} className="w-56 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Raise WO"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
