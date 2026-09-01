import { cookies } from "next/headers";
import Link from "next/link";
import { StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";

interface Dashboard {
  kpis: {
    draftPrCount: number;
    openRfqCount: number;
    openPoCount: number;
    grnCount: number;
    raAnomalyCount: number;
  };
}

export default async function ProcurementDashboardPage() {
  const token = (await cookies()).get("access_token")?.value;
  let dash: Dashboard | null = null;
  try {
    dash = await serverApi(token).get<Dashboard>("/v1/procurement/dashboard");
  } catch { /* degraded */ }
  const k = dash?.kpis;

  return (
    <main className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Procurement dashboard</h2>
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Live counts from vendor, PR, RFQ, PO, GRN and RA bill records. API is the system of record.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Draft PRs" value={String(k?.draftPrCount ?? "—")} tone={(k?.draftPrCount ?? 0) > 0 ? "warning" : "success"} />
        <StatCard label="Open RFQs" value={String(k?.openRfqCount ?? "—")} tone={(k?.openRfqCount ?? 0) > 0 ? "warning" : undefined} />
        <StatCard label="Open / partial POs" value={String(k?.openPoCount ?? "—")} />
        <StatCard label="GRNs posted" value={String(k?.grnCount ?? "—")} />
        <StatCard label="RA anomalies" value={String(k?.raAnomalyCount ?? "—")} tone={(k?.raAnomalyCount ?? 0) > 0 ? "danger" : "success"} />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Exceptions</h3>
          <ul className="space-y-2 text-sm">
            <li>Draft PRs waiting approval: {k?.draftPrCount ?? "—"}</li>
            <li>Open RFQs: {k?.openRfqCount ?? "—"}</li>
            <li>RA bills with anomalies: {k?.raAnomalyCount ?? "—"}</li>
          </ul>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Raise</h3>
          <p className="mb-3 text-sm" style={{ color: "var(--bo-text-muted)" }}>Maker cannot approve their own PR.</p>
          <Link href="/procurement/prs" className="text-sm font-medium" style={{ color: "var(--bo-primary)" }}>Purchase requisitions</Link>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Award</h3>
          <p className="mb-3 text-sm" style={{ color: "var(--bo-text-muted)" }}>L1 comparison, then award to PO. Duplicate poNo is refused.</p>
          <Link href="/procurement/rfqs" className="text-sm font-medium" style={{ color: "var(--bo-primary)" }}>RFQ comparison</Link>
        </div>
      </section>
    </main>
  );
}
