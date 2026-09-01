"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

const KINDS = ["sanctioned_plan", "fire_noc", "environmental", "cc", "oc", "lift_licence", "labour_licence"];

export function ApprovalForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("fire_noc");
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
        kind,
        ref,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
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
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-lg border p-4 md:grid-cols-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {KINDS.map((k) => <option key={k} value={k}>{k.replaceAll("_", " ")}</option>)}
      </select>
      <input required placeholder="Reference / licence no" value={ref} onChange={(e) => setRef(e.target.value)}
        className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input type="date" value={expiresAt} onChange={(e) => setExp(e.target.value)}
        className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Add to register"}
      </button>
      {error && <p className="md:col-span-4 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
