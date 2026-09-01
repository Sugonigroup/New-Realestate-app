"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApi } from "@/lib/api";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Draft {
  id: string;
  leadId: string;
  channel: string;
  intent: string;
  body: string;
  status: string;
}

/** AI drafts; approve posts to /v1/crm/ai/drafts/:id/approve. */
export default function CrmDraftsPage() {
  const [rows, setRows] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    browserApi()
      .get<Draft[]>("/v1/crm/ai/drafts")
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function approve(id: string) {
    setBusy(id);
    setError(null);
    try {
      await browserApi().post(`/v1/crm/ai/drafts/${id}/approve`, {});
      setRows((cur) => cur.filter((d) => d.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">AI drafts</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>Approve to send through the consent gate</p>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      <div className="space-y-3">
        {rows.map((d) => (
          <div key={d.id} className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{d.channel} · {d.intent.replace(/_/g, " ")}</span>
              <button type="button" disabled={busy === d.id} onClick={() => void approve(d.id)} className="rounded px-3 py-1 text-xs text-white" style={{ background: "var(--bo-primary)" }}>
                {busy === d.id ? "Sending…" : "Approve & send"}
              </button>
            </div>
            <p className="whitespace-pre-wrap text-xs" style={{ color: "var(--bo-text-muted)" }}>{d.body}</p>
          </div>
        ))}
        {rows.length === 0 && !error && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No drafts.</div>}
      </div>
    </main>
  );
}
