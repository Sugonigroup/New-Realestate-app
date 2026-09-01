import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../finance-nav";
import { BankForms } from "./bank-forms";

interface BankAccount { id: string; accountNo: string; bankName: string; ifsc: string; isEscrow: boolean; balancePaise: string }
interface BankTx { id: string; bankAccountId: string; date: string; amountPaise: string; narration: string; utr: string | null; matched: boolean }

export default async function BankPage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let accounts: BankAccount[] = [];
  let txs: BankTx[] = [];
  try {
    accounts = (await api.get<BankAccount[]>("/v1/gl/bank/accounts")) ?? [];
    txs = (await api.get<BankTx[]>("/v1/gl/bank/transactions")) ?? [];
  } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Bank reconciliation</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Auto-match cleared receipts by UTR or exact amount. Unmatched lines stay visible until matched.
      </p>
      <div className="mb-4 flex flex-wrap gap-3">
        {accounts.map((a) => (
          <div key={a.id} className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div className="font-medium">{a.bankName} {a.accountNo}</div>
            <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{a.ifsc} {a.isEscrow ? "· RERA escrow" : ""}</div>
            <MoneyText paise={BigInt(a.balancePaise)} />
          </div>
        ))}
      </div>
      <BankForms accounts={accounts} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {txs.map((t) => (
          <div key={t.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div>{new Date(t.date).toLocaleDateString("en-IN")} · {t.narration}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{t.utr ?? "no UTR"}</div>
            </div>
            <div className="flex items-center gap-3">
              <MoneyText paise={BigInt(t.amountPaise)} />
              <ToneChip label={t.matched ? "matched" : "unmatched"} tone={t.matched ? "success" : "warning"} />
            </div>
          </div>
        ))}
        {txs.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No bank lines.</div>}
      </div>
    </main>
  );
}
