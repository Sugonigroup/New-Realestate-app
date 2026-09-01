import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../procurement-nav";
import { ApprovePrButton, RaisePrForm } from "./pr-forms";

interface Line { qty: string | number; estRatePaise: string }
interface Pr {
  id: string;
  reqNo: string;
  projectId: string;
  requestedBy: string;
  status: string;
  createdAt: string;
  lines: Line[];
}
interface Project { id: string; code: string; name: string }

function estTotal(lines: Line[]): bigint {
  return lines.reduce((s, l) => {
    try { return s + BigInt(Math.round(Number(l.qty))) * BigInt(l.estRatePaise ?? "0"); }
    catch { return s; }
  }, 0n);
}

function tone(status: string) {
  if (status === "approved") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

export default async function PurchaseRequisitionsPage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let prs: Pr[] = [];
  let projects: Project[] = [];
  try { prs = (await api.get<Pr[]>("/v1/procurement/prs")) ?? []; } catch { /* degraded */ }
  try { projects = (await api.get<Project[]>("/v1/projects")) ?? []; } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Purchase requisitions</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Site indent. Approver cannot be the requester. Issue an RFQ only after approval.
      </p>
      <RaisePrForm projects={projects} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {prs.map((pr) => (
          <div key={pr.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{pr.reqNo} · {pr.lines.length} line(s)</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                project {pr.projectId.slice(0, 8)} · requested by {pr.requestedBy.slice(0, 8)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={estTotal(pr.lines)} />
              <ToneChip label={pr.status} tone={tone(pr.status)} />
              {pr.status === "draft" && <ApprovePrButton id={pr.id} />}
            </div>
          </div>
        ))}
        {prs.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No requisitions yet.</div>}
      </div>
    </main>
  );
}
