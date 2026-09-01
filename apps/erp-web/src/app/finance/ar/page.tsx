import { cookies } from "next/headers";
import Link from "next/link";
import { MoneyText, StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";

interface Aging {
  asOfDate: string;
  totalOutstandingPaise: string;
  buckets: { currentPaise: string; b30to60Paise: string; b60to90Paise: string; b90PlusPaise: string };
  dunningSummary: { level1NoticeCount: number; level2WarningCount: number; level3LegalCount: number };
}

function p(v: string | undefined): bigint {
  try { return BigInt(v ?? "0"); } catch { return 0n; }
}

export default async function ArPage() {
  const token = (await cookies()).get("access_token")?.value;
  let aging: Aging | null = null;
  try {
    aging = await serverApi(token).get<Aging>("/v1/finance/ar/aging");
  } catch { /* degraded */ }

  const b = aging?.buckets;

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Accounts receivable aging</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Open demands (due / overdue). Dunning: 31–60 notice, 61–90 warning, 90+ legal. Interest helper is 18% p.a. RERA.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Outstanding" value={<MoneyText paise={p(aging?.totalOutstandingPaise)} short />} />
        <StatCard label="0–30 days" value={<MoneyText paise={p(b?.currentPaise)} short />} />
        <StatCard label="31–60" value={<MoneyText paise={p(b?.b30to60Paise)} short />} tone="warning" />
        <StatCard label="61–90" value={<MoneyText paise={p(b?.b60to90Paise)} short />} tone="warning" />
        <StatCard label="90+" value={<MoneyText paise={p(b?.b90PlusPaise)} short />} tone="danger" />
      </div>
      <div className="rounded-lg border p-4 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
        <div>Level 1 notices: {aging?.dunningSummary.level1NoticeCount ?? "—"}</div>
        <div>Level 2 warnings: {aging?.dunningSummary.level2WarningCount ?? "—"}</div>
        <div>Level 3 legal: {aging?.dunningSummary.level3LegalCount ?? "—"}</div>
        <Link href="/finance/demands" className="mt-3 inline-block" style={{ color: "var(--bo-primary)" }}>Open demands console</Link>
      </div>
    </main>
  );
}
