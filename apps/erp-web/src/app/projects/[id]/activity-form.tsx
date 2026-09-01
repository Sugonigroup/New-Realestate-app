"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function ActivityForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [days, setDays] = useState("1");
  const [deps, setDeps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(`/v1/projects/${projectId}/activities`, {
        code, name, durationDays: Number(days),
        deps: deps.split(",").map((s) => s.trim()).filter(Boolean),
      });
      setCode("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
      <input required placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} className="w-24 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-48 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="numeric" placeholder="Days" value={days} onChange={(e) => setDays(e.target.value)} className="w-20 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input placeholder="Deps (codes, comma)" value={deps} onChange={(e) => setDeps(e.target.value)} className="w-44 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Add activity"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
