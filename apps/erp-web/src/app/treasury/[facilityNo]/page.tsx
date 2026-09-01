import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";

interface Row {
  month: number;
  openingPaise: string;
  interestPaise: string;
  closingPaise: string;
}

interface Forecast {
  facilityNo: string;
  lenderName: string;
  outstandingPaise: string;
  annualRatePct: number;
  monthlyInterestPaise: string;
  totalInterestFirstYearPaise: string;
  schedule: Row[];
}

/** Interest forecast from GET /v1/treasury/facilities/:facilityNo/interest-forecast. */
export default async function FacilityForecastPage({
  params,
}: {
  params: Promise<{ facilityNo: string }>;
}) {
  const { facilityNo } = await params;
  const f = await loadOne<Forecast>(`/v1/treasury/facilities/${encodeURIComponent(facilityNo)}/interest-forecast`);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Interest forecast {facilityNo}</h1>
      <p className="mb-4 text-sm"><Link href="/treasury" style={{ color: "var(--bo-primary)" }}>← Treasury</Link></p>
      {!f ? (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Forecast unavailable.</p>
      ) : (
        <>
          <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
            {f.lenderName} · {f.annualRatePct}% · outstanding <MoneyText paise={asPaise(f.outstandingPaise)} /> · year-1 interest <MoneyText paise={asPaise(f.totalInterestFirstYearPaise)} />
          </p>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
            {f.schedule.slice(0, 12).map((r) => (
              <div key={r.month} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <span>M{r.month}</span>
                <div className="flex gap-3 text-xs">
                  <span>open <MoneyText paise={asPaise(r.openingPaise)} /></span>
                  <span>int <MoneyText paise={asPaise(r.interestPaise)} /></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
