"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function PourForm() {
  const router = useRouter();
  const [pourNo, setNo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [locationElement, setLoc] = useState("");
  const [concreteGrade, setGrade] = useState("M30");
  const [volume, setVol] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/siteops/quality/pour-cards", {
        pourNo, projectId, locationElement, concreteGrade, targetVolumeCum: Number(volume),
      });
      setNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid max-w-xl grid-cols-2 gap-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Pour no" value={pourNo} onChange={(e) => setNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Project id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Location / element" value={locationElement} onChange={(e) => setLoc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Grade" value={concreteGrade} onChange={(e) => setGrade(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Target m³" value={volume} onChange={(e) => setVol(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Create pour card"}
      </button>
      {error && <p className="col-span-2 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
