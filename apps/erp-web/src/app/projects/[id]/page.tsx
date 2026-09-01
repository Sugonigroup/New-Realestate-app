import { cookies } from "next/headers";
import { StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import Gantt from "./gantt";

interface CpmNode { es: number; ef: number; ls: number; lf: number; float: number; critical: boolean }
interface CpmResult { nodes: Record<string, CpmNode>; projectDuration: number; criticalPath: string[] }

/** Project dashboard (D5): CPM summary tiles + SVG Gantt + milestone runway. */
export default async function ProjectDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);

  let schedule: CpmResult = { nodes: {}, projectDuration: 0, criticalPath: [] };
  let milestones: Array<{ id: string; key: string; label: string; state: string }> = [];
  let approvals: { expired: Array<{ ref: string }>; expiringSoon: Array<{ ref: string }> } = {
    expired: [], expiringSoon: [],
  };
  try {
    schedule = (await api.get<CpmResult>(`/v1/projects/${projectId}/schedule`)) ?? schedule;
    milestones = (await api.get<typeof milestones>(`/v1/projects/${projectId}/milestones`)) ?? [];
    approvals = (await api.get<typeof approvals>(`/v1/projects/${projectId}/approvals`)) ?? [];
  } catch { /* degraded */ }

  const certified = milestones.filter((m) => m.state === "certified").length;

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Project dashboard</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Duration (CPM)" value={`${schedule.projectDuration} d`} />
        <StatCard label="Critical activities" value={String(schedule.criticalPath.length)} />
        <StatCard label="Milestones certified" value={`${certified}/${milestones.length}`} tone={certified === milestones.length ? "success" : "warning"} />
        <StatCard label="Approvals expiring" value={String(approvals.expiringSoon.length)} tone={approvals.expired.length ? "danger" : undefined} />
      </div>

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Schedule (Gantt)</h2>
      <Gantt schedule={schedule} />

      <h2 className="mb-2 mt-8 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Milestone runway</h2>
      <div className="rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {milestones.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <span className="font-medium">{m.label}</span>
              <span className="ml-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>{m.key}</span>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{
              background: m.state === "certified" ? "var(--bo-success)" : "var(--bo-warning)",
              color: "white",
            }}>
              {m.state}
            </span>
          </div>
        ))}
        {milestones.length === 0 && (
          <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No milestones registered.</div>
        )}
      </div>

      <div className="mt-6 text-sm">
        <a href={`/projects/${projectId}/certify`} className="mr-4" style={{ color: "var(--bo-primary)" }}>Certify a milestone</a>
        <a href={`/projects/${projectId}/snags`} className="mr-4" style={{ color: "var(--bo-primary)" }}>Open NCRs</a>
        <a href={`/projects/${projectId}/hse`} className="mr-4" style={{ color: "var(--bo-primary)" }}>HSE</a>
        <a href={`/projects/${projectId}/approvals`} style={{ color: "var(--bo-primary)" }}>Approvals register</a>
      </div>
    </main>
  );
}
