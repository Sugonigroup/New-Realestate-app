"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function VendorForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [gstin, setGstin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/procurement/vendors", { code, name, gstin: gstin || undefined });
      setCode(""); setName(""); setGstin("");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-6 grid grid-cols-1 gap-3 rounded-lg border p-4 md:grid-cols-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="GSTIN" value={gstin} onChange={(e) => setGstin(e.target.value)} />
      <button type="submit" disabled={busy} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Saving…" : "Create vendor"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
