import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";
import WithdrawalForm from "./withdrawal-form";
import { FINANCE_NAV, Subnav } from "@/app/subnav";

interface EscrowSummary {
  collectedPaise: string;
  withdrawnPaise: string;
  parkedRequiredPaise: string;
  withdrawnCapPaise: string;
  maxAdditionalPaise: string;
  breach: boolean;
  utilisationPct: number;
}

const cr = (paise: string) => `₹${(Number(paise) / 1e7).toFixed(2)} Cr`;

/** Escrow dashboard (U2, D2 panel): 70% rule gauge + withdrawals. */
export default async function EscrowPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const token = (await cookies()).get("access_token")?.value;
  let s: EscrowSummary | null = null;
  let error: string | null = null;
  if (projectId) {
    try {
      s = (await serverApi(token).get<EscrowSummary>(`/v1/finance/escrow/summary?projectId=${projectId}`)) ?? null;
    } catch (e) { error = (e as Error).message; }
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Escrow — RERA 70% rule</h1>
      <Subnav items={FINANCE_NAV} />

      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Project ID</label>
          <input name="projectId" defaultValue={projectId ?? ""}
            className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>

      {error && <p style={{ color: "var(--bo-danger)" }}>{error}</p>}

      {s && (
        <>
          {s.breach && (
            <p className="mb-4 rounded border p-3 text-sm font-medium" style={{ borderColor: "var(--bo-danger)", color: "var(--bo-danger)" }}>
              ⚠ ESCROW BREACH — withdrawals exceed the 70% parked requirement
            </p>
          )}
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Collected" value={cr(s.collectedPaise)} />
            <Stat label="70% parked (required)" value={cr(s.parkedRequiredPaise)} />
            <Stat label="Withdrawn" value={cr(s.withdrawnPaise)} tone={s.breach ? "danger" : undefined} />
            <Stat label="Max additional withdrawal" value={cr(s.maxAdditionalPaise)} />
          </div>
          <div className="mb-6">
            <div className="mb-1 flex justify-between text-xs" style={{ color: "var(--bo-text-muted)" }}>
              <span>Utilisation (withdrawn / collected)</span><span>{s.utilisationPct}% / 30% limit</span>
            </div>
            <div className="h-3 w-full rounded" style={{ background: "var(--bo-border)" }}>
              <div className="h-3 rounded" style={{
                width: `${Math.min(s.utilisationPct * (100 / 30), 100)}%`,
                background: s.utilisationPct > 30 ? "var(--bo-danger)" : "var(--bo-success)",
              }} />
            </div>
          </div>
          <WithdrawalForm projectId={projectId ?? ""} certifiedPct={30} />
        </>
      )}
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{label}</div>
      <div className="mt-1 text-lg font-semibold" style={tone === "danger" ? { color: "var(--bo-danger)" } : undefined}>{value}</div>
    </div>
  );
}
