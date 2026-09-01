"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function IssueRfqForm({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const [rfqNo, setRfqNo] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/procurement/rfqs", {
        rfqNo,
        requisitionId,
        closesAt: closesAt ? new Date(closesAt).toISOString() : undefined,
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input required placeholder="RFQ no" value={rfqNo} onChange={(e) => setRfqNo(e.target.value)} className="w-28 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <input type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} className="w-44 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Issue RFQ"}
      </button>
      {error && <span className="max-w-40 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
