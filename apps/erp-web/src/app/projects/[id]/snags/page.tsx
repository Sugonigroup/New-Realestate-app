import { cookies } from "next/headers";
import { StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { StatusChip } from "../../project-nav";
import { RaiseNcrForm, ResolveNcrButton } from "./ncr-forms";

interface Ncr {
  id: string;
  ncrNo: string;
  description: string;
  severity: string;
  status: string;
  rootCause: string | null;
  createdAt: string;
}

function severityTone(s: string): "neutral" | "warning" | "danger" {
  if (s === "critical" || s === "major") return "danger";
  if (s === "medium") return "warning";
  return "neutral";
}

/** NCR / snag board (04 §4, 11 §7). */
export default async function SnagsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const token = (await cookies()).get("access_token")?.value;
  let ncrs: Ncr[] = [];
  try {
    ncrs = (await serverApi(token).get<Ncr[]>(`/v1/siteops/quality/ncrs?projectId=${projectId}`)) ?? [];
  } catch {
    /* degraded */
  }

  const open = ncrs.filter((n) => n.status === "open").length;
  const critical = ncrs.filter((n) => n.severity === "critical" && n.status === "open").length;

  return (
    <main className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Non-conformance register</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Open NCRs" value={open} tone={open ? "warning" : "success"} />
        <StatCard label="Open critical" value={critical} tone={critical ? "danger" : "success"} />
        <StatCard label="Total" value={ncrs.length} />
        <StatCard label="Resolved" value={ncrs.filter((n) => n.status === "resolved").length} tone="success" />
      </div>

      <RaiseNcrForm projectId={projectId} />

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bo-surface)" }}>
              {["NCR", "Severity", "Status", "Description", "Root cause", ""].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--bo-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ncrs.map((n) => (
              <tr key={n.id} className="border-t" style={{ borderColor: "var(--bo-border)" }}>
                <td className="px-3 py-2 font-medium">{n.ncrNo}</td>
                <td className="px-3 py-2"><StatusChip label={n.severity} tone={severityTone(n.severity)} /></td>
                <td className="px-3 py-2"><StatusChip label={n.status} tone={n.status === "open" ? "warning" : "success"} /></td>
                <td className="px-3 py-2">{n.description}</td>
                <td className="px-3 py-2" style={{ color: "var(--bo-text-muted)" }}>{n.rootCause ?? "—"}</td>
                <td className="px-3 py-2">{n.status === "open" ? <ResolveNcrButton ncrNo={n.ncrNo} /> : null}</td>
              </tr>
            ))}
            {ncrs.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--bo-text-muted)" }}>No NCRs. Raise one above or they will block milestone certification.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
