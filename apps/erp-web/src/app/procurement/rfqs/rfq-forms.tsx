"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export function CreateRfqForm({ prs }: { prs: Array<{ id: string; reqNo: string; status: string }> }) {
  const router = useRouter();
  const approved = prs.filter((p) => p.status === "approved");
  const [rfqNo, setRfqNo] = useState("");
  const [requisitionId, setRequisitionId] = useState(approved[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/procurement/rfqs", { rfqNo, requisitionId });
      setRfqNo("");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="RFQ no" value={rfqNo} onChange={(e) => setRfqNo(e.target.value)} />
      <select required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={requisitionId} onChange={(e) => setRequisitionId(e.target.value)}>
        {approved.length === 0 && <option value="">No approved PRs</option>}
        {approved.map((p) => <option key={p.id} value={p.id}>{p.reqNo}</option>)}
      </select>
      <button type="submit" disabled={busy || !requisitionId} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Saving…" : "Issue RFQ"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
