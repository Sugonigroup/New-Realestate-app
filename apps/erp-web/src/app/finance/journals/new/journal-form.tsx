"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { browserApi } from "@/lib/api";

interface Account { code: string; name: string; isPostable: boolean }
interface Line { accountCode: string; debit: string; credit: string; description: string }

function rupeesToPaise(raw: string): string {
  const t = raw.trim();
  if (!t) return "0";
  const neg = t.startsWith("-");
  const n = t.replace(/,/g, "").replace(/^-/, "");
  const [r, f = ""] = n.split(".");
  const whole = BigInt(r || "0");
  const frac = BigInt((f + "00").slice(0, 2));
  const paise = whole * 100n + frac;
  return (neg ? -paise : paise).toString().replace("-", "");
}

export default function JournalForm({ accounts }: { accounts: Account[] }) {
  const router = useRouter();
  const [voucherNo, setVoucherNo] = useState(`JV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-`);
  const [type, setType] = useState("journal");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { accountCode: "", debit: "", credit: "", description: "" },
    { accountCode: "", debit: "", credit: "", description: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let dr = 0n; let cr = 0n;
    for (const l of lines) {
      try { if (l.debit) dr += BigInt(rupeesToPaise(l.debit)); } catch { /* ignore */ }
      try { if (l.credit) cr += BigInt(rupeesToPaise(l.credit)); } catch { /* ignore */ }
    }
    return { dr, cr, ok: dr === cr && dr > 0n };
  }, [lines]);

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post("/v1/gl/journals", {
        voucherNo,
        type,
        date: new Date(date + "T00:00:00.000Z").toISOString(),
        narration: narration || undefined,
        lines: lines.map((l) => ({
          accountCode: l.accountCode,
          debitPaise: rupeesToPaise(l.debit),
          creditPaise: rupeesToPaise(l.credit),
          description: l.description || undefined,
        })),
      });
      router.push("/finance/journals");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Voucher no" value={voucherNo} onChange={(e) => setVoucherNo(e.target.value)} />
        <select className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={type} onChange={(e) => setType(e.target.value)}>
          {["journal", "sales", "purchase", "receipt", "payment", "contra"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input required type="date" className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <input className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Narration" value={narration} onChange={(e) => setNarration(e.target.value)} />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ color: "var(--bo-text-muted)" }}>
            <tr>
              <th className="py-2 text-left">Account</th>
              <th className="py-2 text-right">Debit ₹</th>
              <th className="py-2 text-right">Credit ₹</th>
              <th className="py-2 text-left">Description</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="pr-2">
                  <select required className="w-full rounded border px-2 py-1" style={{ borderColor: "var(--bo-border)" }} value={l.accountCode} onChange={(e) => update(i, { accountCode: e.target.value })}>
                    <option value="">Account</option>
                    {accounts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                  </select>
                </td>
                <td><input className="w-28 rounded border px-2 py-1 text-right" style={{ borderColor: "var(--bo-border)" }} value={l.debit} onChange={(e) => update(i, { debit: e.target.value, credit: e.target.value ? "" : l.credit })} /></td>
                <td><input className="w-28 rounded border px-2 py-1 text-right" style={{ borderColor: "var(--bo-border)" }} value={l.credit} onChange={(e) => update(i, { credit: e.target.value, debit: e.target.value ? "" : l.debit })} /></td>
                <td><input className="w-full rounded border px-2 py-1" style={{ borderColor: "var(--bo-border)" }} value={l.description} onChange={(e) => update(i, { description: e.target.value })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="text-sm" style={{ color: "var(--bo-primary)" }} onClick={() => setLines((p) => [...p, { accountCode: "", debit: "", credit: "", description: "" }])}>
        Add line
      </button>

      <div className="flex items-center justify-between text-sm">
        <span style={{ color: totals.ok ? "var(--bo-success)" : "var(--bo-danger)" }}>
          Dr {totals.dr.toString()} paise · Cr {totals.cr.toString()} paise {totals.ok ? "(balanced)" : "(unbalanced)"}
        </span>
        <button type="submit" disabled={busy || !totals.ok} className="rounded px-4 py-2 text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy ? "Saving…" : "Save draft"}
        </button>
      </div>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
