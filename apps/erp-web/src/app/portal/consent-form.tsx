"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { portalBrowserApi } from "@/lib/api";

export default function ConsentForm() {
  const router = useRouter();
  const [channel, setChannel] = useState("whatsapp");
  const [purpose, setPurpose] = useState("promotional");
  const [granted, setGranted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await portalBrowserApi().post("/v1/portal/consents", { channel, purpose, granted });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 flex flex-wrap items-end gap-3">
      <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["whatsapp", "email", "sms"].map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        {["transactional", "promotional"].map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={granted} onChange={(e) => setGranted(e.target.checked)} />
        Grant
      </label>
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Update consent"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
