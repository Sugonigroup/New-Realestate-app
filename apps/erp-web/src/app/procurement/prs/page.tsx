import Link from "next/link";
import { loadList } from "@/lib/load";
import { PROCUREMENT_NAV, Subnav } from "@/app/subnav";
import { PostButton } from "@/app/post-button";
import CreatePrForm from "./create-form";
import IssueRfqForm from "./issue-rfq-form";

interface PrLine { materialName?: string; materialId: string; qty: string | number }
interface Pr {
  id: string;
  reqNo: string;
  projectId: string;
  requestedBy: string;
  status: string;
  createdAt: string;
  lines?: PrLine[];
}

/** Purchase requisitions from GET /v1/procurement/prs. */
export default async function PurchaseRequisitionsPage() {
  const rows = await loadList<Pr>("/v1/procurement/prs");

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Purchase requisitions</h1>
        <Link href="/procurement/ra-bills" className="text-sm" style={{ color: "var(--bo-primary)" }}>RA bills →</Link>
      </div>
      <Subnav items={PROCUREMENT_NAV} />
      <CreatePrForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((pr) => (
          <div key={pr.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{pr.reqNo}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {(pr.lines ?? []).length} lines · {pr.requestedBy}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{pr.status}</span>
              {pr.status === "draft" && <PostButton path={`/v1/procurement/prs/${pr.id}/approve`} label="Approve" />}
              {pr.status === "approved" && <IssueRfqForm requisitionId={pr.id} />}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No requisitions.</div>}
      </div>
    </main>
  );
}
