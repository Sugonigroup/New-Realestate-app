"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(raw: string): string {
  const t = raw.trim().replace(/,/g, "");
  const neg = t.startsWith("-");
  const n = t.replace(/^-/, "");
  const [r, f = ""] = n.split(".");
  const paise = BigInt(r || "0") * 100n + BigInt((f + "00").slice(0, 2));
  return (neg ? -paise : paise).toString();
}

export function BankForms({ accounts }: { accounts: Array<{ id: string; accountNo: string; bankName: string }> }) {
  const router = useRouter();
  const [bankAccountId, setAcct] = useState(accounts[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function importLine(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await browserApi().post("/v1/gl/bank/transactions/import", {
        bankAccountId,
        transactions: [{
          date: new Date(date + "T00:00:00.000Z").toISOString(),
          amountPaise: rupeesToPaise(amount),
          narration,
          utr: utr || undefined,
        }],
      });
      setMsg("Imported.");
      router.refresh();
    } catch (err) { setMsg((err as Error).message); }
    finally { setBusy(false); }
  }

  async function autoMatch() {
    setBusy(true); setMsg(null);
    try {
      const out = await browserApi().post<{ matched: number }>(`/v1/gl/bank/auto-match?bankAccountId=${bankAccountId}`, {});
      setMsg(`Matched ${out.matched} line(s).`);
      router.refresh();
    } catch (err) { setMsg((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="mb-6 space-y-3">
      <form onSubmit={(e) => void importLine(e)} className="grid grid-cols-2 gap-2 rounded-lg border p-4 md:grid-cols-6" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
        <select className="rounded border px-2 py-2 text-sm md:col-span-2" style={{ borderColor: "var(--bo-border)" }} value={bankAccountId} onChange={(e) => setAcct(e.target.value)}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.bankName} {a.accountNo}</option>)}
        </select>
        <input type="date" className="rounded border px-2 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={date} onChange={(e) => setDate(e.target.value)} />
        <input className="rounded border px-2 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Amount ₹ (+in / −out)" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <input className="rounded border px-2 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} required />
        <input className="rounded border px-2 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="UTR" value={utr} onChange={(e) => setUtr(e.target.value)} />
        <button type="submit" disabled={busy} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>Import line</button>
        <button type="button" disabled={busy} onClick={() => void autoMatch()} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>Auto-match</button>
      </form>
      {msg && <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>{msg}</p>}
    </div>
  );
}
