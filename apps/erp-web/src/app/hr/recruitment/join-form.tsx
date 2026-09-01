"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function JoinForm({ offerNo }: { offerNo: string }) {
  const router = useRouter();
  const [joiningDate, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/hr/recruitment/offers/${encodeURIComponent(offerNo)}/join`, {
        joiningDate: new Date(joiningDate).toISOString(),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input required type="date" value={joiningDate} onChange={(e) => setDate(e.target.value)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Join"}
      </button>
      {error && <span className="max-w-32 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
