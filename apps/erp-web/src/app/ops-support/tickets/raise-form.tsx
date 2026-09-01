"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function RaiseTicketForm() {
  const router = useRouter();
  const [ticketNo, setNo] = useState("");
  const [customerName, setName] = useState("");
  const [customerPhone, setPhone] = useState("");
  const [category, setCat] = useState("snag");
  const [description, setDesc] = useState("");
  const [priority, setPri] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/ops-support/tickets", {
        ticketNo,
        customerName,
        customerPhone,
        category,
        description,
        priority,
        dueOn: new Date(Date.now() + 3 * 86400000).toISOString(),
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
      <input required placeholder="Ticket no" value={ticketNo} onChange={(e) => setNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Customer" value={customerName} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Phone" value={customerPhone} onChange={(e) => setPhone(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Category" value={category} onChange={(e) => setCat(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={priority} onChange={(e) => setPri(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["low", "medium", "high", "critical"].map((p) => <option key={p}>{p}</option>)}
      </select>
      <input required placeholder="Description" value={description} onChange={(e) => setDesc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Raising…" : "Raise ticket"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
