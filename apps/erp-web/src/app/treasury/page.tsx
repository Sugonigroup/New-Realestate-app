import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import Link from "next/link";

interface Facility {
  facilityNo: string;
  lenderName: string;
  facilityType: string;
  outstandingPaise: string;
}

interface Portfolio {
  activeFacilities: number;
  totalSanctionedPaise: string;
  totalDrawnPaise: string;
  totalOutstandingPaise: string;
  monthlyInterestPaise: string;
  facilities: Facility[];
}

/** Debt portfolio from GET /v1/treasury/portfolio. */
export default async function TreasuryPage() {
  const p = await loadOne<Portfolio>("/v1/treasury/portfolio");

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Treasury</h1>
      {!p ? (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>No portfolio data.</p>
      ) : (
        <>
          <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
            {p.activeFacilities} facilities · sanctioned <MoneyText paise={asPaise(p.totalSanctionedPaise)} /> ·
            outstanding <MoneyText paise={asPaise(p.totalOutstandingPaise)} /> · monthly interest{" "}
            <MoneyText paise={asPaise(p.monthlyInterestPaise)} />
          </p>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
            {(p.facilities ?? []).map((f) => (
              <div key={f.facilityNo} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <div>
                  <div className="font-medium">{f.facilityNo} · {f.lenderName}</div>
                  <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{f.facilityType}</div>
                </div>
                <div className="flex items-center gap-3">
                  <MoneyText paise={asPaise(f.outstandingPaise)} />
                  <Link href={`/treasury/${encodeURIComponent(f.facilityNo)}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>forecast</Link>
                </div>
              </div>
            ))}
            {(p.facilities ?? []).length === 0 && (
              <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No active facilities.</div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
