import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import Link from "next/link";
import { PostButton } from "@/app/post-button";
import CreateContractForm from "./create-form";
import SettleForm from "./settle-form";

interface Clause { riskLevel: string }
interface Claim { id: string; claimNo: string; status: string; amountPaise: string }
interface Obligation { id: string; title: string; status: string }
interface Contract {
  id: string;
  contractNo: string;
  title: string;
  partyName: string;
  partyRole: string;
  status: string;
  totalPaise: string;
  clauses?: Clause[];
  claims?: Claim[];
  obligations?: Obligation[];
}

/** Contracts register from GET /v1/contracts. */
export default async function ContractsPage() {
  const rows = await loadList<Contract>("/v1/contracts");
  const highRisk = rows.reduce((n, c) => n + (c.clauses ?? []).filter((x) => x.riskLevel === "high" || x.riskLevel === "critical").length, 0);
  const openClaims = rows.reduce((n, c) => n + (c.claims ?? []).filter((x) => x.status !== "settled" && x.status !== "closed").length, 0);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Contracts</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        {rows.length} contracts · {highRisk} high-risk clauses · {openClaims} open claims
      </p>
      <Subnav items={PROJECT_NAV} />
      <CreateContractForm />
      <div className="mb-4">
        <PostButton path="/v1/contracts/obligations/sweep" label="Sweep overdue obligations" />
      </div>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((c) => (
          <div key={c.id} className="border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{c.contractNo} · {c.title}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {c.partyName} ({c.partyRole}) · {(c.clauses ?? []).length} clauses · {(c.claims ?? []).length} claims · {(c.obligations ?? []).length} obligations
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={asPaise(c.totalPaise)} />
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{c.status}</span>
              {c.status === "draft" && <PostButton path={`/v1/contracts/${c.id}/activate`} label="Activate" />}
              <Link href={`/contracts/${c.id}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>risk</Link>
            </div>
          </div>
          {(c.claims ?? []).filter((x) => x.status !== "settled" && x.status !== "closed").map((cl) => (
            <div key={cl.id} className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--bo-text-muted)" }}>
              <span>Claim {cl.claimNo} · {cl.status}</span>
              <SettleForm claimId={cl.id} />
            </div>
          ))}
          {(c.obligations ?? []).filter((o) => o.status === "pending" || o.status === "overdue").map((o) => (
            <div key={o.id} className="mt-2 flex items-center justify-between text-xs" style={{ color: "var(--bo-text-muted)" }}>
              <span>{o.title} · {o.status}</span>
              <PostButton path={`/v1/contracts/obligations/${o.id}/fulfill`} label="Fulfill" />
            </div>
          ))}
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No contracts.</div>}
      </div>
    </main>
  );
}
