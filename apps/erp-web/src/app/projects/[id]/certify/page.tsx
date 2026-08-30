import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import CertifyForm from "./certify-form";

interface CertificationDecision { ok: boolean; blockers?: string[] }

/** Milestone certification (U3, 11 §3): evidence gate with live blockers display. */
export default async function CertifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const token = (await cookies()).get("access_token")?.value;
  const milestones = await serverApi(token)
    .get<Array<{ id: string; key: string; label: string; state: string }>>(`/v1/projects/${projectId}/milestones`)
    .catch(() => [] as Array<{ id: string; key: string; label: string; state: string }>);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold">Certify a milestone</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Full evidence package required: photos (≥3), closed pour cards, zero open NCRs, Form 3 + Form 4.
      </p>

      <CertifyForm projectId={projectId} />

      <h2 className="mb-2 mt-8 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Registered milestones</h2>
      <div className="rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {milestones.map((m) => (
          <div key={m.id} className="flex items-center justify-between border-b px-4 py-2 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span>{m.label} ({m.key})</span>
            <span>{m.state}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
