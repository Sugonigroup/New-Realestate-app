"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function ExitForm({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("resignation");
  const [lastDay, setLast] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/hr/exits", {
        employeeId, reason, lastWorkingDay: new Date(lastDay).toISOString(),
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
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }}>
        {["resignation", "termination", "absconding", "retirement"].map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <input required type="date" value={lastDay} onChange={(e) => setLast(e.target.value)} className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Exit"}
      </button>
      {error && <span className="max-w-32 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
