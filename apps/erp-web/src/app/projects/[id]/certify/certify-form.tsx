"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";

export default function CertifyForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [photoCount, setPhotos] = useState(3);
  const [pourCards, setPourCards] = useState(true);
  const [openNcrs, setOpenNcrs] = useState(0);
  const [form3, setForm3] = useState("");
  const [form4, setForm4] = useState("");
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setBlockers(null); setOk(false);
    try {
      const token = document.cookie.split("; ").find((c) => c.startsWith("access_token="))?.split("=")[1];
      const res = await fetch(`${CORE_API}/v1/projects/${projectId}/milestones/certify`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({
          key, label, photoCount, pourCardsClosed: pourCards, openNcrs,
          structuralCertificateRef: form3 || undefined,
          caCertificateRef: form4 || undefined,
        }),
      });
      const out = (await res.json()) as { ok?: boolean; blockers?: string[] };
      if (out.ok) { setOk(true); router.refresh(); }
      else setBlockers(out.blockers ?? ["unknown error"]);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <div className="flex gap-3">
        <input className="flex-1 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          placeholder="Key (e.g. plinth)" value={key} onChange={(e) => setKey(e.target.value)} required />
        <input className="flex-1 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          placeholder="Label (e.g. Plinth complete)" value={label} onChange={(e) => setLabel(e.target.value)} required />
      </div>
      <div className="grid grid-cols-3 gap-3 text-sm">
        <label>Photos
          <input type="number" min={0} value={photoCount} onChange={(e) => setPhotos(Number(e.target.value))}
            className="mt-1 w-full rounded border px-3 py-2" style={{ borderColor: "var(--bo-border)" }} />
        </label>
        <label>Open NCRs
          <input type="number" min={0} value={openNcrs} onChange={(e) => setOpenNcrs(Number(e.target.value))}
            className="mt-1 w-full rounded border px-3 py-2" style={{ borderColor: "var(--bo-border)" }} />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" checked={pourCards} onChange={(e) => setPourCards(e.target.checked)} />
          Pour cards closed
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <input className="rounded border px-3 py-2" style={{ borderColor: "var(--bo-border)" }}
          placeholder="Form 3 ref (structural)" value={form3} onChange={(e) => setForm3(e.target.value)} />
        <input className="rounded border px-3 py-2" style={{ borderColor: "var(--bo-border)" }}
          placeholder="Form 4 ref (CA)" value={form4} onChange={(e) => setForm4(e.target.value)} />
      </div>

      {blockers && (
        <ul className="rounded border p-3 text-sm" style={{ borderColor: "var(--bo-danger)", color: "var(--bo-danger)" }}>
          {blockers.map((b, i) => <li key={i}>✗ {b}</li>)}
        </ul>
      )}
      {ok && <p className="text-sm" style={{ color: "var(--bo-success)" }}>Certified — demand engine notified (milestone.certified.v1).</p>}

      <button type="submit" disabled={busy} className="w-full rounded py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Evaluating…" : "Certify milestone"}
      </button>
    </form>
  );
}
