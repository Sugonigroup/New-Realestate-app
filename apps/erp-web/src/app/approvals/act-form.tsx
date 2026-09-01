"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

/** Approve or reject a pending workflow task. */
export default function ActForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(decision: "approve" | "reject") {
    setBusy(true); setError(null);
    try {
      await browserApi().post(`/v1/workflows/tasks/${taskId}/act`, { decision });
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" disabled={busy} onClick={() => act("approve")} className="rounded px-3 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        Approve
      </button>
      <button type="button" disabled={busy} onClick={() => act("reject")} className="rounded border px-3 py-1 text-xs disabled:opacity-50" style={{ borderColor: "var(--bo-border)" }}>
        Reject
      </button>
      {error && <span className="text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </div>
  );
}
