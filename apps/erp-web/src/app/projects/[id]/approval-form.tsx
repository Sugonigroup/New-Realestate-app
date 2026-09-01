"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function ApprovalForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("rera");
  const [ref, setRef] = useState("");
  const [expiresAt, setExp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/projects/${projectId}/approvals`, {
        kind, ref, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      setRef("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
      <input required placeholder="Kind" value={kind} onChange={(e) => setKind(e.target.value)} className="w-28 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Ref" value={ref} onChange={(e) => setRef(e.target.value)} className="w-40 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input type="date" value={expiresAt} onChange={(e) => setExp(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Register approval"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
