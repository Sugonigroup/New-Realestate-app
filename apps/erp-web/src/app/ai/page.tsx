import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";

interface AgentStatus {
  code: string; name: string; ceiling: number;
  runs: number; successPct: number | null; lastRunAt: string | null; costPaise: string;
}

interface RunRecord {
  runId: string; agentCode: string; startedAt: string; status: string;
  decisions: Array<{ recommendation: string; confidence: number; policyVerdict: { verdict: string; level: number | null } }>;
}

/** AI Command Center (D13, U5): agent health, recent runs w/ verdicts. */
export default async function AiCenterPage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let agents: AgentStatus[] = [];
  let runs: RunRecord[] = [];
  try {
    agents = (await api.get<AgentStatus[]>("/v1/ai/status")) ?? [];
    runs = (await api.get<RunRecord[]>("/v1/ai/runs")) ?? [];
  } catch { /* degraded */ }

  const totalCost = agents.reduce((s, a) => s + Number(a.costPaise), 0);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">AI Command Center</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Shadow mode — every action recorded, nothing executes without human approval (L4) or within L3 limits.
      </p>

      <div className="mb-8 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bo-surface)" }}>
              {["Agent", "Ceiling", "Runs", "Success %", "Last run", "Cost"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--bo-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.code} className="border-t" style={{ borderColor: "var(--bo-border)" }}>
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2">L{a.ceiling}</td>
                <td className="px-3 py-2">{a.runs}</td>
                <td className="px-3 py-2">{a.successPct === null ? "—" : `${a.successPct}%`}</td>
                <td className="px-3 py-2">{a.lastRunAt ? new Date(a.lastRunAt).toLocaleString("en-IN") : "—"}</td>
                <td className="px-3 py-2">₹{(Number(a.costPaise) / 100).toFixed(2)}</td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--bo-text-muted)" }}>No agents registered yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>
        Recent runs · total cost ₹{(totalCost / 100).toFixed(2)}
      </h2>
      <div className="space-y-3">
        {runs.map((r) => {
          const d = r.decisions[0];
          return (
            <div key={r.runId} className="rounded-lg border p-3 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div className="flex justify-between">
                <span className="font-medium">{r.agentCode}</span>
                <span className="rounded px-2 py-0.5 text-xs" style={{
                  background: d?.policyVerdict.verdict === "EXECUTE" ? "var(--bo-success)"
                    : d?.policyVerdict.verdict === "APPROVAL_REQUIRED" ? "var(--bo-warning)"
                    : "var(--bo-bg)",
                }}>
                  {d?.policyVerdict.verdict ?? r.status}{d?.policyVerdict.level !== null && d?.policyVerdict.level !== undefined ? ` · L${d.policyVerdict.level}` : ""}
                </span>
              </div>
              {d && <div className="mt-1">{d.recommendation}</div>}
              <div className="mt-1 text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {new Date(r.startedAt).toLocaleString("en-IN")} · confidence {d ? Math.round(d.confidence * 100) : "—"}%
              </div>
            </div>
          );
        })}
        {runs.length === 0 && (
          <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No agent runs yet — they appear here as events fire.</p>
        )}
      </div>
    </main>
  );
}
