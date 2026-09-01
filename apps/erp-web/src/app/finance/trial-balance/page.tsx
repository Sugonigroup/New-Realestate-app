import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";

interface TbRow { accountCode: string; debitPaise: string; creditPaise: string }
interface Account { code: string; name: string }

export default async function TrialBalancePage() {
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let tb: TbRow[] = [];
  let accounts: Account[] = [];
  try {
    tb = (await api.get<TbRow[]>("/v1/gl/trial-balance")) ?? [];
    accounts = (await api.get<Account[]>("/v1/gl/accounts")) ?? [];
  } catch { /* degraded */ }
  const names = new Map(accounts.map((a) => [a.code, a.name]));
  const totDr = tb.reduce((s, r) => s + BigInt(r.debitPaise), 0n);
  const totCr = tb.reduce((s, r) => s + BigInt(r.creditPaise), 0n);

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Trial balance</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>Posted journals as of now. Totals must match.</p>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-left text-sm">
          <thead style={{ background: "var(--bo-bg)", color: "var(--bo-text-muted)" }}>
            <tr>
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Account</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {tb.map((r) => (
              <tr key={r.accountCode} className="border-t" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <td className="px-4 py-2 font-mono text-xs">{r.accountCode}</td>
                <td className="px-4 py-2">{names.get(r.accountCode) ?? r.accountCode}</td>
                <td className="px-4 py-2 text-right"><MoneyText paise={BigInt(r.debitPaise)} /></td>
                <td className="px-4 py-2 text-right"><MoneyText paise={BigInt(r.creditPaise)} /></td>
              </tr>
            ))}
            <tr className="border-t font-semibold" style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }}>
              <td className="px-4 py-2" colSpan={2}>Total</td>
              <td className="px-4 py-2 text-right"><MoneyText paise={totDr} /></td>
              <td className="px-4 py-2 text-right"><MoneyText paise={totCr} /></td>
            </tr>
          </tbody>
        </table>
      </div>
      {totDr !== totCr && <p className="mt-3 text-sm" style={{ color: "var(--bo-danger)" }}>Trial balance is out of balance — investigate reversals.</p>}
    </main>
  );
}
