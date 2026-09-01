import { loadList, loadOne } from "@/lib/load";
import { OPS_NAV, Subnav } from "@/app/subnav";
import { PostButton } from "@/app/post-button";
import RaiseTicketForm from "./raise-form";

interface Ticket {
  id: string;
  ticketNo: string;
  customerName: string;
  category: string;
  priority: string;
  status: string;
  dueOn: string;
}

interface Metrics {
  totalTickets: number;
  slaBreachPct: number;
  avgCsat: number | null;
  resolvedCount: number;
}

/** Customer tickets from GET /v1/ops-support/tickets. */
export default async function TicketsPage() {
  const [rows, metrics] = await Promise.all([
    loadList<Ticket>("/v1/ops-support/tickets"),
    loadOne<Metrics>("/v1/ops-support/tickets/csat-sla"),
  ]);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Customer tickets</h1>
      <Subnav items={OPS_NAV} />
      {metrics && (
        <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          {metrics.totalTickets} tickets · {metrics.resolvedCount} resolved · SLA breach {metrics.slaBreachPct}%
          {metrics.avgCsat != null ? ` · CSAT ${metrics.avgCsat}` : ""}
        </p>
      )}
      <RaiseTicketForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((t) => (
          <div key={t.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{t.ticketNo} · {t.customerName}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {t.category} · {t.priority} · due {new Date(t.dueOn).toLocaleDateString("en-IN")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{t.status}</span>
              {t.status !== "resolved" && t.status !== "closed" && (
                <PostButton path={`/v1/ops-support/tickets/${encodeURIComponent(t.ticketNo)}/resolve`} body={{ csatRating: 5 }} label="Resolve" />
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No tickets.</div>}
      </div>
    </main>
  );
}
