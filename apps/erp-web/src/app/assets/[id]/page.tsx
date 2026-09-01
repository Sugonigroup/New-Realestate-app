import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";
import MeterForm from "./meter-form";
import WorkOrderForm from "./wo-form";
import PlanForm from "./plan-form";

interface Dep {
  assetTag: string;
  purchaseValPaise: string;
  salvageValPaise: string;
  usefulLifeMonths: number;
  monthlyDepreciationPaise: string;
  monthsElapsed: number;
  accumulatedDepreciationPaise: string;
  netBookValuePaise: string;
  isFullyDepreciated: boolean;
}

interface Rel {
  assetTag: string;
  failureCount: number;
  mtbfHours: number | null;
  mttrHours: number | null;
}

/** Asset depreciation + reliability. */
export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [dep, rel] = await Promise.all([
    loadOne<Dep>(`/v1/assets/${id}/depreciation`),
    loadOne<Rel>(`/v1/assets/${id}/reliability`),
  ]);

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Asset {dep?.assetTag ?? rel?.assetTag ?? ""}</h1>
      <Subnav items={PROJECT_NAV} />
      <p className="mb-4 text-sm"><Link href="/assets" style={{ color: "var(--bo-primary)" }}>← Assets</Link></p>
      {dep && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["NBV", null as string | null],
            ["Monthly dep", null],
            ["Elapsed", `${dep.monthsElapsed}/${dep.usefulLifeMonths} mo`],
            ["Fully dep", dep.isFullyDepreciated ? "yes" : "no"],
          ].map(([label, v]) => (
            <div key={label} className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>{label}</div>
              <div className="mt-1 text-lg font-semibold">
                {label === "NBV" ? <MoneyText paise={asPaise(dep.netBookValuePaise)} /> : label === "Monthly dep" ? <MoneyText paise={asPaise(dep.monthlyDepreciationPaise)} /> : v}
              </div>
            </div>
          ))}
        </div>
      )}
      {rel && (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Failures {rel.failureCount} · MTBF {rel.mtbfHours ?? "—"}h · MTTR {rel.mttrHours ?? "—"}h
        </p>
      )}
      {!dep && !rel && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Asset metrics unavailable.</p>}
      <MeterForm assetId={id} />
      <WorkOrderForm assetId={id} />
      <PlanForm assetId={id} />
    </main>
  );
}
