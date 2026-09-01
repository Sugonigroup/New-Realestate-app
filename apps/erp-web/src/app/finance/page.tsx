import { cookies } from "next/headers";
import Link from "next/link";
import { MoneyText, StatCard } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "./finance-nav";

interface Dashboard {
  asOf: string;
  period: { period: string; status: string };
  kpis: {
    cashBankPaise: string;
    receivablesPaise: string;
    payablesPaise: string;
    customerAdvancesPaise: string;
    revenuePaise: string;
    expensesPaise: string;
    profitabilityPaise: string;
    overdueReceivablesPaise: string;
    unmatchedBankCount: number;
    draftJournalCount: number;
  };
}

function paise(v: string | undefined): bigint {
  try { return BigInt(v ?? "0"); } catch { return 0n; }
}

export default async function FinanceDashboardPage() {
  const token = (await cookies()).get("access_token")?.value;
  let dash: Dashboard | null = null;
  try {
    dash = await serverApi(token).get<Dashboard>("/v1/gl/dashboard");
  } catch { /* degraded */ }

  const k = dash?.kpis;
  const periodTone = dash?.period.status === "open" ? "success" : dash?.period.status === "soft_closed" ? "warning" : dash?.period.status === "hard_closed" ? "danger" : "neutral";
  const profit = paise(k?.profitabilityPaise);

  return (
    <main className="p-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Finance dashboard</h2>
          <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
            Posted journals only. Drafts and closed periods never hit these tiles.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: "var(--bo-text-muted)" }}>Period</span>
          <ToneChip label={dash?.period.period ?? "—"} />
          <ToneChip label={dash?.period.status ?? "unknown"} tone={periodTone} />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Cash and bank" value={<MoneyText paise={paise(k?.cashBankPaise)} short />} />
        <StatCard label="Receivables" value={<MoneyText paise={paise(k?.receivablesPaise)} short />} />
        <StatCard label="Payables" value={<MoneyText paise={paise(k?.payablesPaise)} short />} tone="warning" />
        <StatCard label="Customer advances" value={<MoneyText paise={paise(k?.customerAdvancesPaise)} short />} />
        <StatCard label="Revenue YTD" value={<MoneyText paise={paise(k?.revenuePaise)} short />} tone="success" />
        <StatCard label="Expenses YTD" value={<MoneyText paise={paise(k?.expensesPaise)} short />} />
        <StatCard label="Project profitability" value={<MoneyText paise={profit} short />} tone={profit >= 0n ? "success" : "danger"} />
        <StatCard label="Overdue receivables" value={<MoneyText paise={paise(k?.overdueReceivablesPaise)} short />} tone={paise(k?.overdueReceivablesPaise) > 0n ? "danger" : "success"} />
        <StatCard label="Unmatched bank" value={String(k?.unmatchedBankCount ?? "—")} tone={(k?.unmatchedBankCount ?? 0) > 0 ? "warning" : "success"} />
        <StatCard label="Draft journals" value={String(k?.draftJournalCount ?? "—")} tone={(k?.draftJournalCount ?? 0) > 0 ? "warning" : undefined} />
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Exceptions</h3>
          <ul className="space-y-2 text-sm">
            <li>Draft journals waiting to post: {k?.draftJournalCount ?? "—"}</li>
            <li>Unmatched bank lines: {k?.unmatchedBankCount ?? "—"}</li>
            <li>Overdue AR (31d+): <MoneyText paise={paise(k?.overdueReceivablesPaise)} /></li>
          </ul>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Post</h3>
          <p className="mb-3 text-sm" style={{ color: "var(--bo-text-muted)" }}>Double-entry only. Posted vouchers cannot be edited.</p>
          <Link href="/finance/journals/new" className="text-sm font-medium" style={{ color: "var(--bo-primary)" }}>New journal entry</Link>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <h3 className="mb-2 text-sm font-medium uppercase" style={{ color: "var(--bo-text-muted)" }}>Close</h3>
          <p className="mb-3 text-sm" style={{ color: "var(--bo-text-muted)" }}>Soft-close locks the month. Hard-close is CFO-only.</p>
          <Link href="/finance/periods" className="text-sm font-medium" style={{ color: "var(--bo-primary)" }}>Fiscal periods</Link>
        </div>
      </section>
    </main>
  );
}
