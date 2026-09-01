import Link from "next/link";
import { loadList } from "@/lib/load";
import { PROCUREMENT_NAV, Subnav } from "@/app/subnav";

interface Rfq {
  id: string;
  rfqNo: string;
  status: string;
  closesAt: string | null;
  lines?: Array<{ materialName: string }>;
}

/** RFQs from GET /v1/procurement/rfqs. */
export default async function RfqsPage() {
  const rows = await loadList<Rfq>("/v1/procurement/rfqs");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">RFQs</h1>
      <Subnav items={PROCUREMENT_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{r.rfqNo}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {(r.lines ?? []).length} lines{r.closesAt ? ` · closes ${new Date(r.closesAt).toLocaleDateString("en-IN")}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{r.status}</span>
              <Link href={`/procurement/rfqs/${r.id}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>compare</Link>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No RFQs.</div>}
      </div>
    </main>
  );
}
