"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

/** Quick interaction log — optimistic add, refreshes the server timeline. */
export default function InteractionForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [type, setType] = useState("call");
  const [disposition, setDisposition] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await browserApi().post(`/v1/crm/leads/${leadId}/interactions`, { type, disposition: disposition || undefined, notes: notes || undefined });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border px-2 py-1 text-sm" style={{ borderColor: "var(--bo-border)" }}>
          <option value="call">Call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
          <option value="note">Note</option>
        </select>
        <input
          className="flex-1 rounded border px-2 py-1 text-sm"
          style={{ borderColor: "var(--bo-border)" }}
          placeholder="Disposition (e.g. interested, callback)"
          value={disposition}
          onChange={(e) => setDisposition(e.target.value)}
        />
      </div>
      <textarea
        className="w-full rounded border px-2 py-1 text-sm"
        style={{ borderColor: "var(--bo-border)" }}
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="submit" disabled={busy} className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Log interaction"}
      </button>
    </form>
  );
}
