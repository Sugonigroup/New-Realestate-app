"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface ImportReport {
  imported: number;
  duplicates: number;
  rejected: Array<{ row: number; reason: string }>;
}

/** CSV import for POST /v1/crm/leads/import (fullName,phone,email,segment,language). */
export default function LeadImportPage() {
  const [csv, setCsv] = useState("fullName,phone,email,segment,language\n");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const out = await browserApi().post<ImportReport>("/v1/crm/leads/import", { csv });
      setReport(out);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Import leads</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Header row required: fullName, phone, email, segment, language
      </p>
      <form onSubmit={submit} className="max-w-2xl space-y-3">
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={12}
          className="w-full rounded border px-3 py-2 font-mono text-sm"
          style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
        />
        {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
        <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>
          {busy ? "Importing…" : "Import CSV"}
        </button>
      </form>
      {report && (
        <div className="mt-6 text-sm">
          <p>{report.imported} imported · {report.duplicates} duplicates · {report.rejected.length} rejected</p>
          {report.rejected.map((r) => (
            <p key={r.row} style={{ color: "var(--bo-danger)" }}>row {r.row}: {r.reason}</p>
          ))}
        </div>
      )}
    </main>
  );
}
