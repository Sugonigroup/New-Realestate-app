import { loadList } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Upcoming {
  nextOn: string;
  event: {
    id: string;
    eventType: string;
    person?: { displayName?: string; consentStatus?: string; preferredChannel?: string };
  };
}

/** Upcoming relationship moments from GET /v1/crm/engagement/upcoming. */
export default async function EngagementPage() {
  const rows = await loadList<Upcoming>("/v1/crm/engagement/upcoming?days=14");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Engagement</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>Next 14 days of relationship events</p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.event.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{r.event.person?.displayName ?? "—"} · {r.event.eventType}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {r.event.person?.preferredChannel ?? "—"} · consent {r.event.person?.consentStatus ?? "unknown"}
              </div>
            </div>
            <span className="text-xs">{new Date(r.nextOn).toLocaleDateString("en-IN")}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No upcoming events.</div>}
      </div>
    </main>
  );
}
