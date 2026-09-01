"use client";

import { useEffect, useState } from "react";
import { CRM_NAV, Subnav } from "@/app/subnav";
import { browserApi } from "@/lib/api";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";
const readCookie = (k: string) => document.cookie.split("; ").find((c) => c.startsWith(k + "="))?.split("=")[1] ?? null;

interface QueueItem {
  kind: string;
  priority: number;
  ref: string;
  title: string;
  dueOn?: string;
}

const KIND_LABEL: Record<string, string> = { sla: "SLA", task: "Task", reactivate: "Win-back" };
const KIND_TONE: Record<string, string> = {
  sla: "bg-rose-100 text-rose-800",
  task: "bg-blue-100 text-blue-800",
  reactivate: "bg-amber-100 text-amber-800",
};

/** Site-Sales Work Queue (RECRM-017 / CRM-UI mobile-first): prioritized daily action list. */
export default function WorkQueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    fetch(`${CORE_API}/v1/crm/work-queue`, { headers: { authorization: `Bearer ${readCookie("access_token") ?? ""}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`queue ${r.status}`))))
      .then((res: { queue: QueueItem[] }) => setQueue(res.queue))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-md p-4">
      <h1 className="mb-1 text-xl font-semibold">Today&apos;s Work Queue</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        SLA calls first, then tasks, then win-backs — ordered by urgency
      </p>
      <button
        type="button"
        disabled={sweeping}
        onClick={() => {
          setSweeping(true);
          browserApi().post("/v1/crm/automation/sla-sweep", {}).catch((e: Error) => setError(e.message)).finally(() => setSweeping(false));
        }}
        className="mb-4 rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: "var(--bo-primary)" }}
      >
        {sweeping ? "Sweeping…" : "Run SLA sweep"}
      </button>
      {error && <p className="mb-3 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      {loading ? (
        <p style={{ color: "var(--bo-text-muted)" }}>Loading…</p>
      ) : queue.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm" style={{ borderColor: "var(--bo-border)", color: "var(--bo-text-muted)" }}>
          Queue clear. Nice.
        </div>
      ) : (
        <ul className="space-y-2">
          {queue.map((item, i) => (
            <li key={`${item.kind}-${item.ref}`} className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{item.title}</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${KIND_TONE[item.kind] ?? "bg-slate-100"}`}>
                    {KIND_LABEL[item.kind] ?? item.kind}
                  </span>
                  {item.dueOn && (
                    <span className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                      due {new Date(item.dueOn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              </div>
              {item.kind === "sla" && (
                <a href={`/crm/leads/${item.ref}`} className="shrink-0 self-center text-xs font-medium" style={{ color: "var(--bo-primary)" }}>
                  open →
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
