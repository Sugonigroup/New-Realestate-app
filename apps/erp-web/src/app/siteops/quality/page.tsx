"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import PourForm from "./pour-form";
import PourFollowup from "./pour-followup";

/** NCR from POST /v1/siteops/quality/ncrs. */
export default function QualityPage() {
  const [ncrNo, setNo] = useState("");
  const [projectId, setProjectId] = useState("");
  const [description, setDesc] = useState("");
  const [severity, setSev] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await browserApi().post("/v1/siteops/quality/ncrs", { ncrNo, projectId, description, severity });
      setOk("NCR raised");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Quality NCR</h1>
      <Subnav items={PROJECT_NAV} />
      <PourForm />
      <PourFollowup />
      <form onSubmit={submit} className="grid max-w-xl gap-3">
        <input required placeholder="NCR no" value={ncrNo} onChange={(e) => setNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Project id" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <select value={severity} onChange={(e) => setSev(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
          {["minor", "medium", "major", "critical"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <textarea required placeholder="Description" value={description} onChange={(e) => setDesc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy ? "Raising…" : "Raise NCR"}
        </button>
        {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
        {ok && <p className="text-sm" style={{ color: "var(--bo-success)" }}>{ok}</p>}
      </form>
    </main>
  );
}
