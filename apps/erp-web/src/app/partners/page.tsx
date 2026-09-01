import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";

interface Dash {
  error?: string;
  partner?: { code: string; name: string; reraAgentNo: string | null };
  leads?: Array<{ id: string; name: string; status: string }>;
  commissions?: {
    accruedPaise: string;
    paidPaise: string;
    entries: Array<{ bookingId: string; accruedPaise: string; status: string }>;
  };
}

/** Channel partner dashboard from GET /v1/partners/:code/dashboard. */
export default async function PartnerPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const d = code ? await loadOne<Dash>(`/v1/partners/${encodeURIComponent(code)}/dashboard`) : null;

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Partner portal</h1>
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Partner code</label>
          <input name="code" defaultValue={code ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      {d?.partner && (
        <>
          <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
            {d.partner.name} · {d.partner.code}{d.partner.reraAgentNo ? ` · RERA ${d.partner.reraAgentNo}` : ""}
            {d.commissions ? <> · accrued <MoneyText paise={asPaise(d.commissions.accruedPaise)} /> · paid <MoneyText paise={asPaise(d.commissions.paidPaise)} /></> : null}
          </p>
          <h2 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Leads</h2>
          <div className="mb-6 overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
            {(d.leads ?? []).map((l) => (
              <div key={l.id} className="flex justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <span>{l.name}</span>
                <span>{l.status}</span>
              </div>
            ))}
            {(d.leads ?? []).length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No partner leads.</div>}
          </div>
        </>
      )}
      {code && !d?.partner && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>{d?.error ?? "Partner not found."}</p>}
    </main>
  );
}
