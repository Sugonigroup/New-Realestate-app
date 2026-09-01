import { cookies } from "next/headers";
import { StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { StatusChip } from "../../project-nav";
import { ApprovalForm } from "./approval-form";

interface ApprovalDoc {
  id: string;
  kind: string;
  ref: string;
  expiresAt: string | null;
}

interface ApprovalsPayload {
  docs: ApprovalDoc[];
  expired: ApprovalDoc[];
  expiringSoon: ApprovalDoc[];
}

function docTone(doc: ApprovalDoc, expiredIds: Set<string>, soonIds: Set<string>): "danger" | "warning" | "success" | "neutral" {
  if (!doc.expiresAt) return "neutral";
  if (expiredIds.has(doc.id)) return "danger";
  if (soonIds.has(doc.id)) return "warning";
  return "success";
}

function docLabel(doc: ApprovalDoc, expiredIds: Set<string>, soonIds: Set<string>): string {
  if (!doc.expiresAt) return "no expiry";
  if (expiredIds.has(doc.id)) return "expired";
  if (soonIds.has(doc.id)) return "expiring";
  return "valid";
}

/** Approvals register with T-60 expiry chips (WP-3A). */
export default async function ApprovalsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const token = (await cookies()).get("access_token")?.value;
  let payload: ApprovalsPayload = { docs: [], expired: [], expiringSoon: [] };
  try {
    payload = (await serverApi(token).get<ApprovalsPayload>(`/v1/projects/${projectId}/approvals`)) ?? payload;
  } catch {
    /* degraded */
  }
  const expiredIds = new Set(payload.expired.map((d) => d.id));
  const soonIds = new Set(payload.expiringSoon.map((d) => d.id));

  return (
    <main className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Approvals register</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="On register" value={payload.docs.length} />
        <StatCard label="Expired" value={payload.expired.length} tone={payload.expired.length ? "danger" : "success"} />
        <StatCard label="Expiring (60d)" value={payload.expiringSoon.length} tone={payload.expiringSoon.length ? "warning" : "success"} />
      </div>

      <ApprovalForm projectId={projectId} />

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bo-surface)" }}>
              {["Kind", "Reference", "Expires", "Status"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--bo-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payload.docs.map((d) => (
              <tr key={d.id} className="border-t" style={{ borderColor: "var(--bo-border)" }}>
                <td className="px-3 py-2 font-medium">{d.kind.replaceAll("_", " ")}</td>
                <td className="px-3 py-2">{d.ref}</td>
                <td className="px-3 py-2">{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString("en-IN") : "—"}</td>
                <td className="px-3 py-2">
                  <StatusChip label={docLabel(d, expiredIds, soonIds)} tone={docTone(d, expiredIds, soonIds)} />
                </td>
              </tr>
            ))}
            {payload.docs.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--bo-text-muted)" }}>No approvals on the register.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
