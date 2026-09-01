"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface ExportOut {
  csv: string;
  filename: string;
}

/** Downloads CSV from GET /v1/crm/leads/export. */
export default function LeadExportPage() {
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const q = status ? `?status=${encodeURIComponent(status)}` : "";
      const out = await browserApi().get<ExportOut>(`/v1/crm/leads/export${q}`);
      const blob = new Blob([out.csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = out.filename ?? "leads.csv";
      a.click();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Export leads</h1>
      <Subnav items={CRM_NAV} />
      <div className="flex max-w-md items-end gap-3">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Status filter</label>
          <input value={status} onChange={(e) => setStatus(e.target.value)} className="w-48 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="button" disabled={busy} onClick={() => void download()} className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>
          {busy ? "Exporting…" : "Download CSV"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </main>
  );
}
