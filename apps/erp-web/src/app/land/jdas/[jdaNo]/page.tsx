import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { asPaise, loadOne } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";

interface Split {
  jdaNo: string;
  landownerName: string;
  landownerSharePct: number;
  developerSharePct: number;
  totalAreaSqFt: number;
  landownerAreaSqFt: number;
  totalProjectRevenuePaise: string;
  landownerRevenuePaise: string;
  developerRevenuePaise: string;
}

/** JDA revenue split from GET /v1/land/jdas/:jdaNo/split. */
export default async function JdaSplitPage({
  params,
  searchParams,
}: {
  params: Promise<{ jdaNo: string }>;
  searchParams: Promise<{ totalRevenuePaise?: string }>;
}) {
  const { jdaNo } = await params;
  const { totalRevenuePaise } = await searchParams;
  const split = totalRevenuePaise
    ? await loadOne<Split>(`/v1/land/jdas/${encodeURIComponent(jdaNo)}/split?totalRevenuePaise=${encodeURIComponent(totalRevenuePaise)}`)
    : null;

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">JDA split {jdaNo}</h1>
      <Subnav items={PROJECT_NAV} />
      <p className="mb-4 text-sm"><Link href="/land" style={{ color: "var(--bo-primary)" }}>← Land</Link></p>
      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Total revenue (paise)</label>
          <input name="totalRevenuePaise" defaultValue={totalRevenuePaise ?? ""} className="w-56 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Calculate</button>
      </form>
      {split && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Landowner</div>
            <div className="mt-1 text-lg font-semibold">{split.landownerName}</div>
            <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{split.landownerSharePct}% · {split.landownerAreaSqFt.toLocaleString("en-IN")} sqft</div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>LO revenue</div>
            <div className="mt-1 text-lg font-semibold"><MoneyText paise={asPaise(split.landownerRevenuePaise)} /></div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Dev revenue</div>
            <div className="mt-1 text-lg font-semibold"><MoneyText paise={asPaise(split.developerRevenuePaise)} /></div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Total</div>
            <div className="mt-1 text-lg font-semibold"><MoneyText paise={asPaise(split.totalProjectRevenuePaise)} /></div>
          </div>
        </div>
      )}
      {!split && totalRevenuePaise && (
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Split unavailable.</p>
      )}
    </main>
  );
}
