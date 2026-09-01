import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Forecast {
  openCount: number;
  grossPipelinePaise: string;
  weightedPipelinePaise: string;
  wonPaise: string;
  lostCount: number;
  byStage: Record<string, { count: number; valuePaise: string }>;
}

interface VisitFunnel {
  totalVisits: number;
  completed: number;
  noShow: number;
  completionPct: number;
  visitToOpportunityPct: number;
}

/** Pipeline forecast + visit funnel. */
export default async function CrmForecastPage() {
  const [fc, visits] = await Promise.all([
    loadOne<Forecast>("/v1/crm/analytics/pipeline-forecast"),
    loadOne<VisitFunnel>("/v1/crm/analytics/visit-funnel"),
  ]);

  const stages = Object.entries(fc?.byStage ?? {});

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Pipeline forecast</h1>
      <Subnav items={CRM_NAV} />
      {fc && (
        <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          {fc.openCount} open · gross <MoneyText paise={asPaise(fc.grossPipelinePaise)} /> · weighted <MoneyText paise={asPaise(fc.weightedPipelinePaise)} /> · won <MoneyText paise={asPaise(fc.wonPaise)} /> · {fc.lostCount} lost
        </p>
      )}
      {visits && (
        <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Visits {visits.totalVisits} · done {visits.completed} ({visits.completionPct}%) · no-show {visits.noShow} · visit-to-opp {visits.visitToOpportunityPct}%
        </p>
      )}
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {stages.map(([stage, s]) => (
          <div key={stage} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-medium">{stage.replace(/_/g, " ")}</span>
            <div className="flex items-center gap-3">
              <span>{s.count}</span>
              <MoneyText paise={asPaise(s.valuePaise)} />
            </div>
          </div>
        ))}
        {stages.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No open pipeline.</div>}
      </div>
    </main>
  );
}
