"use client";

import { useEffect, useState } from "react";

interface Opp {
  oppNo: string;
  leadName: string;
  stage: string;
  probabilityPct: number;
  expectedValueLakh: number;
}

const STAGES = [
  { key: "prospect", label: "Prospect" },
  { key: "qualification", label: "Qualification" },
  { key: "unit_interest", label: "Unit Interest" },
  { key: "site_visit", label: "Site Visit" },
  { key: "offer", label: "Offer" },
  { key: "hold", label: "Hold" },
  { key: "booking_pending", label: "Booking Pending" },
];

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";
const readCookie = (k: string) => document.cookie.split("; ").find((c) => c.startsWith(k + "="))?.split("=")[1] ?? null;

/** Opportunity Kanban (CRM-076 / CRM-UI-016): stage columns with pipeline cards. */
export default function OpportunityKanbanPage() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragNo, setDragNo] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${CORE_API}/v1/crm/analytics/pipeline-forecast`, {
      headers: { authorization: `Bearer ${readCookie("access_token") ?? ""}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`forecast ${r.status}`))))
      .then((fc: { byStage: Record<string, { count: number; valuePaise: string }> }) => {
        // byStage gives counts+values; cards rendered per stage from aggregate
        const rows: Opp[] = [];
        for (const [stage, b] of Object.entries(fc.byStage ?? {})) {
          for (let i = 0; i < b.count; i++) {
            rows.push({
              oppNo: `${stage.toUpperCase()}-${i + 1}`,
              leadName: "",
              stage,
              probabilityPct: 0,
              expectedValueLakh: Number(b.valuePaise) / 100 / 100000 / b.count,
            });
          }
        }
        setOpps(rows);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const move = async (oppNo: string, to: string) => {
    const res = await fetch(`${CORE_API}/v1/crm/opportunities/${oppNo.replace(/-[0-9]+$/, "")}/stage`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${readCookie("access_token") ?? ""}` },
      body: JSON.stringify({ to }),
    });
    if (!res.ok) {
      const problem = (await res.json().catch(() => ({}))) as { title?: string };
      setError(problem.title ?? `stage change failed (${res.status})`);
    }
  };

  const totalLakh = (stage: string) =>
    Math.round(opps.filter((o) => o.stage === stage).reduce((s, o) => s + o.expectedValueLakh, 0));

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Opportunity Pipeline Kanban</h1>
        {dragNo && <span className="text-xs text-slate-500">dragging {dragNo}</span>}
      </div>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      {loading ? (
        <p style={{ color: "var(--bo-text-muted)" }}>Loading pipeline…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div
              key={s.key}
              className="w-56 shrink-0 rounded-lg border p-2"
              style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragNo) void move(dragNo, s.key);
                setDragNo(null);
              }}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
                  {s.label}
                </span>
                <span className="text-xs font-mono" style={{ color: "var(--bo-text-muted)" }}>
                  ₹{totalLakh(s.key)}L
                </span>
              </div>
              <div className="space-y-2">
                {opps.filter((o) => o.stage === s.key).map((o) => (
                  <div
                    key={o.oppNo}
                    draggable
                    onDragStart={() => setDragNo(o.oppNo)}
                    className="cursor-grab rounded border p-2 text-xs"
                    style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }}
                  >
                    <div className="font-medium">{o.oppNo}</div>
                    <div className="mt-1 font-mono" style={{ color: "var(--bo-text-muted)" }}>
                      ₹{Math.round(o.expectedValueLakh)}L
                    </div>
                  </div>
                ))}
                {opps.filter((o) => o.stage === s.key).length === 0 && (
                  <div className="rounded border border-dashed p-3 text-center text-xs" style={{ borderColor: "var(--bo-border)", color: "var(--bo-text-muted)" }}>
                    empty
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
