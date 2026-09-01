import { cookies } from "next/headers";
import { StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { StatusChip } from "../../project-nav";
import { ApprovePermitButton, IncidentForm, PermitForm } from "./hse-forms";

interface SafetyScore {
  safetyScore: number;
  rating: string;
  totalIncidents: number;
  severeIncidents: number;
  activePermitsCount: number;
}
interface Permit {
  id: string;
  permitNo: string;
  workType: string;
  location: string;
  status: string;
  safetyOfficer: string;
  validFrom: string;
  validTo: string;
}
interface Incident {
  id: string;
  incidentNo: string;
  severity: number;
  location: string;
  description: string;
  status: string;
  reportedAt: string;
}

function scoreTone(n: number): "success" | "warning" | "danger" {
  if (n >= 90) return "success";
  if (n >= 60) return "warning";
  return "danger";
}

/** HSE (04 §4, 11 §8): PTW board + incidents + site safety score. */
export default async function HsePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let score: SafetyScore = { safetyScore: 100, rating: "EXCELLENT", totalIncidents: 0, severeIncidents: 0, activePermitsCount: 0 };
  let permits: Permit[] = [];
  let incidents: Incident[] = [];
  try {
    score = (await api.get<SafetyScore>(`/v1/siteops/hse/projects/${projectId}/safety-score`)) ?? score;
    permits = (await api.get<Permit[]>(`/v1/siteops/hse/permits?projectId=${projectId}`)) ?? [];
    incidents = (await api.get<Incident[]>(`/v1/siteops/hse/incidents?projectId=${projectId}`)) ?? [];
  } catch {
    /* degraded */
  }

  return (
    <main className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Health, safety & environment</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Safety score" value={`${score.safetyScore} · ${score.rating.replaceAll("_", " ")}`} tone={scoreTone(score.safetyScore)} />
        <StatCard label="Incidents" value={score.totalIncidents} tone={score.totalIncidents ? "warning" : "success"} />
        <StatCard label="Severe (3–5)" value={score.severeIncidents} tone={score.severeIncidents ? "danger" : "success"} />
        <StatCard label="Active PTW" value={score.activePermitsCount} />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <PermitForm projectId={projectId} />
        <IncidentForm projectId={projectId} />
      </div>

      <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Permits</h3>
      <div className="mb-8 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bo-surface)" }}>
              {["PTW", "Type", "Location", "Officer", "Status", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--bo-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permits.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: "var(--bo-border)" }}>
                <td className="px-3 py-2 font-medium">{p.permitNo}</td>
                <td className="px-3 py-2">{p.workType.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{p.location}</td>
                <td className="px-3 py-2">{p.safetyOfficer}</td>
                <td className="px-3 py-2"><StatusChip label={p.status} tone={p.status === "active" ? "success" : "warning"} /></td>
                <td className="px-3 py-2">{p.status === "requested" ? <ApprovePermitButton permitNo={p.permitNo} /> : null}</td>
              </tr>
            ))}
            {permits.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--bo-text-muted)" }}>No permits issued.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Incidents</h3>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bo-surface)" }}>
              {["No", "Sev", "Location", "Description", "Status"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--bo-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {incidents.map((i) => (
              <tr key={i.id} className="border-t" style={{ borderColor: "var(--bo-border)" }}>
                <td className="px-3 py-2 font-medium">{i.incidentNo}</td>
                <td className="px-3 py-2"><StatusChip label={String(i.severity)} tone={i.severity >= 3 ? "danger" : "warning"} /></td>
                <td className="px-3 py-2">{i.location}</td>
                <td className="px-3 py-2">{i.description}</td>
                <td className="px-3 py-2">{i.status}</td>
              </tr>
            ))}
            {incidents.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: "var(--bo-text-muted)" }}>No incidents recorded.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
