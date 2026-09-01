import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { loadPortal } from "@/lib/load";
import { PORTAL_NAV, Subnav } from "@/app/subnav";

interface Payments {
  schedule: Array<{ seq: number; label: string; amountFormatted: string; dueDate: string | null }>;
  receipts: Array<{ id: string; amountFormatted: string; instrument: string; clearedAt: string | null }>;
}

/** Payment schedule + receipts from GET /v1/portal/payments. */
export default async function PortalPaymentsPage() {
  if (!(await cookies()).get("portal_access_token")?.value) redirect("/portal");
  const data = await loadPortal<Payments>("/v1/portal/payments");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Payments</h1>
      <Subnav items={PORTAL_NAV} />
      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Schedule</h2>
      <div className="mb-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(data?.schedule ?? []).map((s) => (
          <div key={s.seq} className="flex justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span>{s.seq}. {s.label}</span>
            <span>{s.amountFormatted}</span>
          </div>
        ))}
        {(data?.schedule ?? []).length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No schedule.</div>}
      </div>
      <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Receipts</h2>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {(data?.receipts ?? []).map((r) => (
          <div key={r.id} className="flex justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span>{r.instrument}{r.clearedAt ? ` · ${new Date(r.clearedAt).toLocaleDateString("en-IN")}` : ""}</span>
            <span>{r.amountFormatted}</span>
          </div>
        ))}
        {(data?.receipts ?? []).length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No receipts.</div>}
      </div>
    </main>
  );
}
