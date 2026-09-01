"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function CompleteWoForm({ woNo }: { woNo: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/assets/work-orders/${encodeURIComponent(woNo)}/complete`, {
        completedAt: new Date().toISOString(),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={() => void run()} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Complete"}
      </button>
      {error && <span className="max-w-32 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </span>
  );
}
