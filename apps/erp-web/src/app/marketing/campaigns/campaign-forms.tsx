"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export function CreateCampaignForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("meta");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/marketing/campaigns", { name, channel, projectId: projectId || undefined });
      setName("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
      <input required placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} className="w-48 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["meta", "google", "portal", "offline", "referral"].map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input placeholder="Project id (optional)" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-48 rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Create"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}

export function SpendForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [rupees, setRupees] = useState("");
  const [leads, setLeads] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/marketing/spend", {
        campaignId, date: new Date().toISOString(), spendPaise: rupeesToPaise(rupees), leads: Number(leads),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input required inputMode="decimal" placeholder="Spend ₹" value={rupees} onChange={(e) => setRupees(e.target.value)} className="w-24 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="numeric" placeholder="Leads" value={leads} onChange={(e) => setLeads(e.target.value)} className="w-16 rounded border px-2 py-1 text-xs" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : "Spend"}
      </button>
      {error && <span className="max-w-32 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </form>
  );
}
