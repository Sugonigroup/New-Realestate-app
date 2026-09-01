import { loadOne } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import HseActions from "./actions";

interface Score {
  projectId: string;
  totalIncidents: number;
  severeIncidents: number;
  activePermitsCount: number;
  safetyScore: number;
  rating: string;
}

/** Site safety score from GET /v1/siteops/hse/projects/:id/safety-score. */
export default async function HsePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const score = projectId
    ? await loadOne<Score>(`/v1/siteops/hse/projects/${projectId}/safety-score`)
    : null;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">HSE safety score</h1>
      <Subnav items={PROJECT_NAV} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Project ID</label>
          <input name="projectId" defaultValue={projectId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      {score && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Score", String(score.safetyScore)],
            ["Rating", score.rating.replace(/_/g, " ")],
            ["Incidents", String(score.totalIncidents)],
            ["Severe", String(score.severeIncidents)],
            ["Active permits", String(score.activePermitsCount)],
          ].map(([label, v]) => (
            <div key={label} className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{label}</div>
              <div className="mt-1 text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
      )}
      {projectId && !score && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No HSE data for this project.</p>}
      <HseActions projectId={projectId} />
    </main>
  );
}
