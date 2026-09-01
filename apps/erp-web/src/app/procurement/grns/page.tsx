import { loadList } from "@/lib/load";
import { PROCUREMENT_NAV, Subnav } from "@/app/subnav";
import GrnForm from "./grn-form";

interface GrnLine {
  id: string;
  materialId: string;
  qty: string | number;
  acceptedQty: string | number;
  rejectedQty: string | number;
  remark?: string | null;
}

interface Grn {
  id: string;
  grnNo: string;
  orderId: string;
  projectId: string;
  vendorId: string;
  status: string;
  receivedAt: string;
  lines?: GrnLine[];
}

/** Goods receipts from GET /v1/procurement/grns; POST posts a new GRN. */
export default async function GrnPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; projectId?: string; poLineId?: string }>;
}) {
  const defaults = await searchParams;
  const rows = await loadList<Grn>("/v1/procurement/grns");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Goods receipts</h1>
      <Subnav items={PROCUREMENT_NAV} />
      <GrnForm defaults={defaults} />
      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>
        Posted receipts
      </h2>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((g) => (
          <div key={g.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{g.grnNo}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {(g.lines ?? []).length} lines · PO {g.orderId.slice(0, 8)}… · {new Date(g.receivedAt).toLocaleString()}
              </div>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{g.status}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No GRNs posted.</div>}
      </div>
    </main>
  );
}
