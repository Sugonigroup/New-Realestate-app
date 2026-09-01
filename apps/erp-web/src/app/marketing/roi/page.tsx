import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { MARKETING_NAV, Subnav } from "@/app/subnav";

interface Roi {
  attributed: Array<{ campaignId: string; bookings: number; valuePaise: string }>;
  efficiency: Array<{
    campaignId: string;
    spendPaise: string;
    leads: number;
    cplPaise: string | null;
    bookings: number;
    cpbPaise: string | null;
  }>;
}

/** Campaign ROI from GET /v1/marketing/roi (first-touch). */
export default async function MarketingRoiPage() {
  const roi = await loadOne<Roi>("/v1/marketing/roi");
  const rows = roi?.efficiency ?? [];

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Campaign ROI</h1>
      <Subnav items={MARKETING_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>First-touch attribution · CPL / CPB</p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.campaignId} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-mono text-xs">{r.campaignId.slice(0, 8)}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{r.leads} leads · {r.bookings} bookings</div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span>spend <MoneyText paise={asPaise(r.spendPaise)} /></span>
              <span>CPL {r.cplPaise ? <MoneyText paise={asPaise(r.cplPaise)} /> : "—"}</span>
              <span>CPB {r.cpbPaise ? <MoneyText paise={asPaise(r.cpbPaise)} /> : "—"}</span>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No campaign spend yet.</div>}
      </div>
    </main>
  );
}
