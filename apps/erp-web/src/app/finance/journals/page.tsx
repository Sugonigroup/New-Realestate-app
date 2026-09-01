import { cookies } from "next/headers";
import Link from "next/link";
import { MoneyText } from "@buildos/ui";
import { serverApi } from "@/lib/api";
import { ToneChip } from "../finance-nav";
import { JournalActions } from "./journal-actions";

interface Journal {
  id: string;
  voucherNo: string;
  type: string;
  date: string;
  narration: string | null;
  status: string;
  lines: Array<{ debitPaise: string; creditPaise: string }>;
}

export default async function JournalsPage() {
  const token = (await cookies()).get("access_token")?.value;
  let journals: Journal[] = [];
  try {
    journals = (await serverApi(token).get<Journal[]>("/v1/gl/journals")) ?? [];
  } catch { /* degraded */ }

  const tone = (s: string) => s === "posted" ? "success" : s === "draft" ? "warning" : s === "reversed" ? "danger" : "neutral";

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Journal register</h2>
          <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>Immutable when posted. Reverse to correct.</p>
        </div>
        <Link href="/finance/journals/new" className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>
          New journal
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {journals.map((j) => {
          const debit = j.lines.reduce((s, l) => s + BigInt(l.debitPaise), 0n);
          return (
            <div key={j.id} className="flex items-center justify-between gap-3 border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div>
                <div className="font-medium">{j.voucherNo} <span className="ml-2 text-xs font-normal" style={{ color: "var(--bo-text-muted)" }}>{j.type}</span></div>
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  {new Date(j.date).toLocaleDateString("en-IN")} · {j.narration ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <MoneyText paise={debit} />
                <ToneChip label={j.status} tone={tone(j.status)} />
                <JournalActions id={j.id} status={j.status} />
              </div>
            </div>
          );
        })}
        {journals.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No journals.</div>}
      </div>
    </main>
  );
}
