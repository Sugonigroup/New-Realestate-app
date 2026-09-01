"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function RaiseRiskForm() {
  const router = useRouter();
  const [riskNo, setNo] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCat] = useState("schedule");
  const [probability, setP] = useState("3");
  const [impact, setI] = useState("3");
  const [ownerRole, setOwner] = useState("project_manager");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/ops-support/risks", {
        riskNo,
        title,
        category,
        probability: Number(probability),
        impact: Number(impact),
        ownerRole,
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
      <input required placeholder="Risk no" value={riskNo} onChange={(e) => setNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={category} onChange={(e) => setCat(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["financial", "safety", "compliance", "schedule", "quality", "reputational"].map((c) => <option key={c}>{c}</option>)}
      </select>
      <input required placeholder="P 1-5" value={probability} onChange={(e) => setP(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="I 1-5" value={impact} onChange={(e) => setI(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Owner role" value={ownerRole} onChange={(e) => setOwner(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Raising…" : "Raise risk"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
