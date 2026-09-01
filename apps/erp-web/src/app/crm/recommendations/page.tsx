"use client";

import { useCallback, useEffect, useState } from "react";
import { browserApi } from "@/lib/api";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Rec {
  id: string;
  recType: string;
  reason: string;
  confidence: number;
  impact: string;
  targetType: string;
  targetId: string;
  dueOn: string | null;
  status: string;
}

/** Pending AI recommendations; accept/reject posts to /v1/crm/ai/recommendations/:id/decide. */
export default function RecommendationsPage() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    browserApi()
      .get<Rec[]>("/v1/crm/ai/recommendations")
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function decide(id: string, accept: boolean) {
    setBusy(id);
    setError(null);
    try {
      await browserApi().post(`/v1/crm/ai/recommendations/${id}/decide`, { accept });
      setRows((cur) => cur.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setBusy("gen");
    setError(null);
    try {
      await browserApi().post("/v1/crm/ai/generate-recommendations", {});
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">AI recommendations</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>Human accept required before a task is created</p>
      <button type="button" disabled={busy === "gen"} onClick={() => void generate()} className="mb-4 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy === "gen" ? "Generating…" : "Generate recs"}
      </button>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.id} className="border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{r.recType.replace(/_/g, " ")} · {r.impact}</div>
                <div className="mt-1 text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  {r.reason} · conf {r.confidence}% · {r.targetType} {r.targetId.slice(0, 8)}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" disabled={busy === r.id} onClick={() => void decide(r.id, true)} className="rounded px-2 py-1 text-xs text-white" style={{ background: "var(--bo-primary)" }}>Accept</button>
                <button type="button" disabled={busy === r.id} onClick={() => void decide(r.id, false)} className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>Reject</button>
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && !error && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No pending recommendations.</div>}
      </div>
    </main>
  );
}
