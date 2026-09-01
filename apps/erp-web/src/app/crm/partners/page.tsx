import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Credit {
  partnerRef: string;
  leads: number;
  opportunities: number;
  wonBookings: number;
  wonValuePaise: string;
}

/** Partner attribution from GET /v1/crm/partners/:partnerRef/credit. */
export default async function PartnerCreditPage({
  searchParams,
}: {
  searchParams: Promise<{ partnerRef?: string }>;
}) {
  const { partnerRef } = await searchParams;
  const c = partnerRef ? await loadOne<Credit>(`/v1/crm/partners/${encodeURIComponent(partnerRef)}/credit`) : null;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Partner credit</h1>
      <Subnav items={CRM_NAV} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Partner ref</label>
          <input name="partnerRef" defaultValue={partnerRef ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      {c && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Leads</div>
            <div className="mt-1 text-lg font-semibold">{c.leads}</div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Opps</div>
            <div className="mt-1 text-lg font-semibold">{c.opportunities}</div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Won</div>
            <div className="mt-1 text-lg font-semibold">{c.wonBookings}</div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Won value</div>
            <div className="mt-1"><MoneyText paise={asPaise(c.wonValuePaise)} /></div>
          </div>
        </div>
      )}
      {partnerRef && !c && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No credit data.</p>}
    </main>
  );
}
