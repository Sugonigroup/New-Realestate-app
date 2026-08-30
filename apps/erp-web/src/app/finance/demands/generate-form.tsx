"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

/** Bulk demand generation from the booking's schedule (certified milestones optional). */
export default function GenerateForm() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState("");
  const [certified, setCertified] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/finance/demands/generate", {
        bookingId,
        certifiedMilestones: certified ? certified.split(",").map((s) => s.trim()) : undefined,
      });
      router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-3">
      <div>
        <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Booking ID</label>
        <input className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          value={bookingId} onChange={(e) => setBookingId(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Certified milestones (comma-sep)</label>
        <input className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          placeholder="plinth,slab_3" value={certified} onChange={(e) => setCertified(e.target.value)} />
      </div>
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Generating…" : "Generate demands"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
