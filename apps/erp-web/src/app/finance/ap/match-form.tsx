"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(raw: string): string {
  const n = raw.trim().replace(/,/g, "");
  const [r, f = ""] = n.split(".");
  return (BigInt(r || "0") * 100n + BigInt((f + "00").slice(0, 2))).toString();
}

export default function MatchForm() {
  const router = useRouter();
  const [invoiceNo, setInvoiceNo] = useState("");
  const [vendorId, setVendorId] = useState("ultratech");
  const [invoice, setInvoice] = useState("");
  const [po, setPo] = useState("");
  const [grn, setGrn] = useState("");
  const [tdsBps, setTds] = useState("200");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setResult(null);
    try {
      const out = await browserApi().post<{ status: string; tdsPaise: string }>("/v1/gl/ap/invoices/match", {
        invoiceNo, vendorId,
        invoiceAmountPaise: rupeesToPaise(invoice),
        poTotalPaise: rupeesToPaise(po),
        grnTotalPaise: rupeesToPaise(grn),
        tdsBps: Number(tdsBps),
      });
      setResult(`Status ${out.status}. TDS paise ${out.tdsPaise}.`);
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-6 grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Invoice no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Vendor id" value={vendorId} onChange={(e) => setVendorId(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Invoice ₹" value={invoice} onChange={(e) => setInvoice(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="PO total ₹" value={po} onChange={(e) => setPo(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="GRN total ₹" value={grn} onChange={(e) => setGrn(e.target.value)} />
      <input className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="TDS bps" value={tdsBps} onChange={(e) => setTds(e.target.value)} />
      <button type="submit" disabled={busy} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Matching…" : "Run 3-way match"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      {result && <p className="col-span-full text-sm" style={{ color: "var(--bo-success)" }}>{result}</p>}
    </form>
  );
}
