import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import ClaimForm from "./claim-form";
import ClauseForm from "./clause-form";

interface Risk {
  contractNo: string;
  status: string;
  totalPaise: string;
  openClaimsCount: number;
  openClaimsPaise: string;
  exposureVsContractPct: number;
  overdueObligationsCount: number;
  highRiskClausesCount: number;
  riskLevel: string;
}

/** Contract risk from GET /v1/contracts/:id/risk. */
export default async function ContractRiskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await loadOne<Risk>(`/v1/contracts/${id}/risk`);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Contract risk {r?.contractNo ?? ""}</h1>
      <Subnav items={PROJECT_NAV} />
      <p className="mb-4 text-sm"><Link href="/contracts" style={{ color: "var(--bo-primary)" }}>← Contracts</Link></p>
      {!r ? (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Risk profile unavailable.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Level", r.riskLevel],
            ["Status", r.status],
            ["Open claims", String(r.openClaimsCount)],
            ["Exposure", `${r.exposureVsContractPct}%`],
            ["Overdue obligations", String(r.overdueObligationsCount)],
            ["High-risk clauses", String(r.highRiskClausesCount)],
          ].map(([label, v]) => (
            <div key={label} className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{label}</div>
              <div className="mt-1 text-lg font-semibold">{v}</div>
            </div>
          ))}
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Value</div>
            <div className="mt-1"><MoneyText paise={asPaise(r.totalPaise)} /></div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Open claims</div>
            <div className="mt-1"><MoneyText paise={asPaise(r.openClaimsPaise)} /></div>
          </div>
        </div>
      )}
      <ClaimForm contractId={id} />
      <ClauseForm contractId={id} />
    </main>
  );
}
