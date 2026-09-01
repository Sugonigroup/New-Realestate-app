"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export function RaiseNcrForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [ncrNo, setNo] = useState("");
  const [description, setDesc] = useState("");
  const [severity, setSev] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/siteops/quality/ncrs", { ncrNo, projectId, description, severity });
      setNo("");
      setDesc("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <h3 className="text-sm font-medium">Raise NCR</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <input required placeholder="NCR no (NCR-2026-014)" value={ncrNo} onChange={(e) => setNo(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <select value={severity} onChange={(e) => setSev(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
          {["minor", "medium", "major", "critical"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <button type="submit" disabled={busy} className="rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy ? "Saving…" : "Raise"}
        </button>
      </div>
      <textarea required placeholder="Description" value={description} onChange={(e) => setDesc(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm" rows={2} style={{ borderColor: "var(--bo-border)" }} />
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}

export function ResolveNcrButton({ ncrNo }: { ncrNo: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rootCause, setRoot] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await browserApi().post(`/v1/siteops/quality/ncrs/${encodeURIComponent(ncrNo)}/resolve`, { rootCause });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium" style={{ color: "var(--bo-primary)" }}>
        Resolve
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex gap-2">
      <input required placeholder="Root cause" value={rootCause} onChange={(e) => setRoot(e.target.value)}
        className="rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="text-xs font-medium" style={{ color: "var(--bo-primary)" }}>Save</button>
    </form>
  );
}
