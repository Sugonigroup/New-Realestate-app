import { cookies } from "next/headers";
import Link from "next/link";
import { StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { StatusChip } from "./project-nav";

interface ProjectCard {
  id: string;
  code: string;
  name: string;
  city: string | null;
  state: string | null;
  status: string;
  segmentKind: string;
  reraNumber: string | null;
  startDate: string | null;
  endDate: string | null;
  milestonesCertified: number;
  milestonesTotal: number;
  activityCount: number;
  approvalsExpired: number;
  approvalsExpiringSoon: number;
}

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (status === "under_construction" || status === "handover") return "success";
  if (status === "planning") return "warning";
  return "neutral";
}

/** Projects index (04 §3 / D5): portfolio health tiles, no more guessing UUIDs. */
export default async function ProjectsIndexPage() {
  const token = (await cookies()).get("access_token")?.value;
  let projects: ProjectCard[] = [];
  try {
    projects = (await serverApi(token).get<ProjectCard[]>("/v1/projects")) ?? [];
  } catch {
    /* degraded */
  }

  const live = projects.filter((p) => p.status === "under_construction").length;
  const expiryAlerts = projects.reduce((n, p) => n + p.approvalsExpired + p.approvalsExpiringSoon, 0);

  return (
    <main className="p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
            <Link href="/">Dashboard</Link> / Projects
          </p>
          <h1 className="text-xl font-semibold">Projects</h1>
          <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
            Schedule, certifications, QC, HSE and statutory approvals per project.
          </p>
        </div>
      </div>

      <section className="mb-6 flex flex-wrap gap-4">
        <StatCard label="Active projects" value={projects.length} />
        <StatCard label="Under construction" value={live} tone="success" />
        <StatCard label="Approval alerts" value={expiryAlerts} tone={expiryAlerts ? "warning" : "success"} />
      </section>

      {projects.length === 0 ? (
        <p style={{ color: "var(--bo-text-muted)" }}>No projects in this tenant yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => {
            const certPct = p.milestonesTotal ? Math.round((p.milestonesCertified / p.milestonesTotal) * 100) : 0;
            const healthTone =
              p.approvalsExpired > 0 ? "danger" : p.approvalsExpiringSoon > 0 ? "warning" : "success";
            return (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="block rounded-lg border p-4"
                style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium" style={{ color: "var(--bo-text-muted)" }}>
                      {p.code} · {p.segmentKind} · {p.city ?? "—"}
                    </div>
                    <h2 className="text-lg font-semibold">{p.name}</h2>
                  </div>
                  <StatusChip label={p.status.replaceAll("_", " ")} tone={statusTone(p.status)} />
                </div>
                <p className="mb-3 text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  RERA {p.reraNumber ?? "unregistered"}
                </p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Milestones</div>
                    <div className="font-medium">{p.milestonesCertified}/{p.milestonesTotal} ({certPct}%)</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Activities</div>
                    <div className="font-medium">{p.activityCount}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Approvals</div>
                    <div className="font-medium" style={{ color: healthTone === "danger" ? "var(--bo-danger)" : healthTone === "warning" ? "var(--bo-warning)" : "var(--bo-text)" }}>
                      {p.approvalsExpired} expired · {p.approvalsExpiringSoon} T-60
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
