"use client";

import { useEffect, useState } from "react";
import { CRM_NAV, Subnav } from "@/app/subnav";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";
const readCookie = (k: string) => document.cookie.split("; ").find((c) => c.startsWith(k + "="))?.split("=")[1] ?? null;

interface Diary {
  date: string;
  calls: Array<{ leadId: string; leadName: string; disposition: string | null; at: string }>;
  callCount: number;
  visitsToday: number;
  tasksCompleted: number;
  tasksOpen: number;
}

/** Sales Diary (RECRM-016): the rep's day — calls, visits, task throughput. */
export default function SalesDiaryPage() {
  const [diary, setDiary] = useState<Diary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${CORE_API}/v1/crm/sales-diary`, { headers: { authorization: `Bearer ${readCookie("access_token") ?? ""}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`diary ${r.status}`))))
      .then(setDiary)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Sales Diary</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        {diary ? `Your day — ${diary.date}` : "Your day at a glance"}
      </p>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      {loading || !diary ? (
        <p style={{ color: "var(--bo-text-muted)" }}>Loading…</p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Calls Today", value: diary.callCount, tone: "" },
              { label: "Site Visits", value: diary.visitsToday, tone: "" },
              { label: "Tasks Done", value: diary.tasksCompleted, tone: "var(--bo-success)" },
              { label: "Tasks Due", value: diary.tasksOpen, tone: diary.tasksOpen > 0 ? "var(--bo-warning)" : "" },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>{k.label}</div>
                <div className="mt-1 text-2xl font-bold" style={k.tone ? { color: k.tone } : undefined}>{k.value}</div>
              </div>
            ))}
          </div>
          <div className="rounded-lg border" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="border-b px-4 py-3 text-sm font-semibold" style={{ borderColor: "var(--bo-border)" }}>Call log — today</div>
            {diary.calls.length === 0 ? (
              <p className="p-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>No calls logged today yet.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--bo-border)" }}>
                {diary.calls.map((c, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span>
                      <a href={`/crm/leads/${c.leadId}`} className="font-medium" style={{ color: "var(--bo-primary)" }}>{c.leadName}</a>
                      <span className="ml-2" style={{ color: "var(--bo-text-muted)" }}>{c.disposition ?? "call"}</span>
                    </span>
                    <span className="font-mono text-xs" style={{ color: "var(--bo-text-muted)" }}>
                      {new Date(c.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
