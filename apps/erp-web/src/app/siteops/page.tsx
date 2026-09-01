import Link from "next/link";
import { loadList } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import InventoryForms from "./inventory-forms";
import MoveForms from "./move-forms";

interface ReorderRow {
  materialId: string;
  materialName: string;
  stockQty: number;
  coverageDays: number;
  reorderLevel: number;
  inboundPoQty: number;
  alert: string;
}

/** Site ops: inventory reorder report (project-scoped). */
export default async function SiteOpsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const rows = projectId
    ? await loadList<ReorderRow>(`/v1/siteops/inventory/reorder?projectId=${projectId}`)
    : [];

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Site operations</h1>
        <div className="flex gap-4 text-sm">
          <Link href="/procurement/ra-bills" style={{ color: "var(--bo-primary)" }}>RA bills →</Link>
          <Link href="/siteops/hse" style={{ color: "var(--bo-primary)" }}>HSE →</Link>
        </div>
      </div>
      <Subnav items={PROJECT_NAV} />

      <InventoryForms projectId={projectId} />
      <MoveForms projectId={projectId} />

      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Project ID</label>
          <input name="projectId" defaultValue={projectId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Reorder report</button>
      </form>

      {projectId && (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
          {rows.map((r) => (
            <div key={r.materialId} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div>
                <div className="font-medium">{r.materialName}</div>
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  stock {r.stockQty} · coverage {r.coverageDays === Infinity ? "∞" : `${r.coverageDays}d`} · inbound {r.inboundPoQty}
                </div>
              </div>
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{r.alert}</span>
            </div>
          ))}
          {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No stock rows.</div>}
        </div>
      )}
    </main>
  );
}
