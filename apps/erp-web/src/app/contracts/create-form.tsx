"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export default function CreateContractForm() {
  const router = useRouter();
  const [contractNo, setNo] = useState("");
  const [title, setTitle] = useState("");
  const [partyName, setParty] = useState("");
  const [partyRole, setRole] = useState("contractor");
  const [rupees, setRupees] = useState("");
  const [from, setFrom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/contracts", {
        contractNo, title, partyName, partyRole,
        totalPaise: rupeesToPaise(rupees),
        effectiveFrom: from ? new Date(from).toISOString() : new Date().toISOString(),
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
    <form onSubmit={submit} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Contract no" value={contractNo} onChange={(e) => setNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Party name" value={partyName} onChange={(e) => setParty(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={partyRole} onChange={(e) => setRole(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["contractor", "vendor", "landowner", "consultant", "client"].map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <input required inputMode="decimal" placeholder="Value ₹" value={rupees} onChange={(e) => setRupees(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Create contract"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
