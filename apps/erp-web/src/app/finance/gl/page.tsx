import { cookies } from "next/headers";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";

interface Account { code: string; name: string; isPostable: boolean }
interface LedgerRow {
  journalId: string;
  voucherNo: string;
  date: string;
  narration: string | null;
  debitPaise: string;
  creditPaise: string;
  runningPaise: string;
}

export default async function GeneralLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ accountCode?: string }>;
}) {
  const { accountCode } = await searchParams;
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);
  let accounts: Account[] = [];
  let rows: LedgerRow[] = [];
  try {
    accounts = (await api.get<Account[]>("/v1/gl/accounts")) ?? [];
    if (accountCode) rows = (await api.get<LedgerRow[]>(`/v1/gl/ledger?accountCode=${encodeURIComponent(accountCode)}`)) ?? [];
  } catch { /* degraded */ }

  const postable = accounts.filter((a) => a.isPostable);

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">General ledger</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Running balance = cumulative debit minus credit on posted journals.
      </p>
      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <select name="accountCode" defaultValue={accountCode ?? ""} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
          <option value="">Select account</option>
          {postable.map((a) => (
            <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
          ))}
        </select>
        <button type="submit" className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>Open</button>
      </form>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-left text-sm">
          <thead style={{ background: "var(--bo-bg)", color: "var(--bo-text-muted)" }}>
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Voucher</th>
              <th className="px-4 py-2">Narration</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
              <th className="px-4 py-2 text-right">Running</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.journalId}-${r.voucherNo}-${r.date}`} className="border-t" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <td className="px-4 py-2">{new Date(r.date).toLocaleDateString("en-IN")}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.voucherNo}</td>
                <td className="px-4 py-2">{r.narration ?? "—"}</td>
                <td className="px-4 py-2 text-right">{r.debitPaise !== "0" ? <MoneyText paise={BigInt(r.debitPaise)} /> : ""}</td>
                <td className="px-4 py-2 text-right">{r.creditPaise !== "0" ? <MoneyText paise={BigInt(r.creditPaise)} /> : ""}</td>
                <td className="px-4 py-2 text-right font-medium"><MoneyText paise={BigInt(r.runningPaise)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {accountCode && rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No posted lines on this account.</p>
        )}
      </div>
    </main>
  );
}
