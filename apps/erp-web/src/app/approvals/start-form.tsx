"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function StartWorkflowForm() {
  const router = useRouter();
  const [action, setAction] = useState("po.approve");
  const [rupees, setRupees] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/workflows/start", {
        action, valuePaise: rupeesToPaise(rupees), payload: {},
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 flex flex-wrap items-end gap-3">
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>Action
        <input required placeholder="po.approve" value={action} onChange={(e) => setAction(e.target.value)} className="mt-1 block w-44 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>Value ₹
        <input required inputMode="decimal" value={rupees} onChange={(e) => setRupees(e.target.value)} className="mt-1 block w-32 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Starting…" : "Start workflow"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
