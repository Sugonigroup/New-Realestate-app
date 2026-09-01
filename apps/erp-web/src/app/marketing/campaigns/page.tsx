import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import { MARKETING_NAV, Subnav } from "@/app/subnav";
import { CreateCampaignForm, SpendForm } from "./campaign-forms";

interface Campaign {
  id: string;
  name: string;
  channel: string;
  status: string;
  spendPaise: string;
}

/** Campaigns from GET /v1/marketing/campaigns. */
export default async function CampaignsPage() {
  const rows = await loadList<Campaign>("/v1/marketing/campaigns");

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Marketing campaigns</h1>
      <Subnav items={MARKETING_NAV} />
      <CreateCampaignForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((c) => (
          <div key={c.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{c.channel}</div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={asPaise(c.spendPaise)} />
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{c.status}</span>
              <SpendForm campaignId={c.id} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No campaigns.</div>}
      </div>
    </main>
  );
}
