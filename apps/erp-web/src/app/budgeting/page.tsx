import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import Link from "next/link";
import { PostButton } from "@/app/post-button";
import CreateBudgetForm from "./create-form";

interface BudgetLine { costCenter: string; accountCode: string; period: string; amountPaise: string }
interface Budget {
  id: string;
  fiscalYear: string;
  title: string;
  versionNo: number;
  status: string;
  totalPaise: string;
  lines?: BudgetLine[];
}

/** Enterprise budgets from GET /v1/budgeting/budgets. */
export default async function BudgetingPage() {
  const rows = await loadList<Budget>("/v1/budgeting/budgets");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Budgeting</h1>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>FP&amp;A versions and line allocations</p>
      <CreateBudgetForm />
      <div className="space-y-4">
        {rows.map((b) => (
          <div key={b.id} className="rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="mb-2 flex items-center justify-between text-sm">
              <div className="font-medium">{b.fiscalYear} · {b.title} · v{b.versionNo}</div>
              <div className="flex items-center gap-3">
                <MoneyText paise={asPaise(b.totalPaise)} />
                <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{b.status}</span>
                <Link href={`/budgeting/variance?budgetId=${b.id}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>variance</Link>
                {b.status === "draft" && <PostButton path={`/v1/budgeting/budgets/${b.id}/approve`} label="Approve" />}
                {b.status === "approved" && <PostButton path={`/v1/budgeting/budgets/${b.id}/lock`} label="Lock" />}
              </div>
            </div>
            {(b.lines ?? []).map((l, i) => (
              <div key={i} className="flex justify-between border-t py-2 text-xs" style={{ borderColor: "var(--bo-border)", color: "var(--bo-text-muted)" }}>
                <span>{l.costCenter} · {l.accountCode} · {l.period}</span>
                <MoneyText paise={asPaise(l.amountPaise)} />
              </div>
            ))}
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No budgets.</div>}
      </div>
    </main>
  );
}
