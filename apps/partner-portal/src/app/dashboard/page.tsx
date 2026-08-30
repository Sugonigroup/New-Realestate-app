import Link from "next/link";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";

interface Dashboard {
  partner: { name: string; reraAgentNo: string | null };
  panelProjectIds: string[];
  leads: Array<{ id: string; name: string; status: string; createdAt: string }>;
  commissions: { accruedPaise: string; paidPaise: string };
  error?: string;
}

/** Partner dashboard (U5): leads, commissions, panel projects. */
export default async function PartnerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  let data: Dashboard | null = null;
  try {
    const res = await fetch(`${CORE_API}/v1/partners/${code}/dashboard`, { cache: "no-store" });
    data = (await res.json()) as Dashboard;
  } catch { /* degraded */ }

  if (!data || data.error) {
    return <main className="p-6 text-sm" style={{ color: "var(--bo-danger)" }}>{data?.error ?? "Not found"}</main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-xl font-semibold">{data.partner.name}</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        RERA agent: {data.partner.reraAgentNo ?? "—"} · {data.panelProjectIds.length} project panel(s)
      </p>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)" }}>
          <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Commission accrued</div>
          <div className="text-lg font-semibold">₹{(Number(data.commissions.accruedPaise) / 100).toFixed(2)}</div>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)" }}>
          <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Commission paid</div>
          <div className="text-lg font-semibold">₹{(Number(data.commissions.paidPaise) / 100).toFixed(2)}</div>
        </div>
      </div>

      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>My leads</h2>
      <div className="rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {data.leads.map((l) => (
          <div key={l.id} className="flex items-center justify-between border-b px-4 py-2 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)" }}>
            <span>{l.name}</span>
            <span style={{ color: "var(--bo-text-muted)" }}>{l.status}</span>
          </div>
        ))}
        {data.leads.length === 0 && <div className="px-4 py-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>No leads yet.</div>}
      </div>
    </main>
  );
}
