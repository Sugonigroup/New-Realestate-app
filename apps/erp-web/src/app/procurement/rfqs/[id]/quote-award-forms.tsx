"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(raw: string): string {
  const n = raw.trim().replace(/,/g, "");
  const [r, f = ""] = n.split(".");
  return (BigInt(r || "0") * 100n + BigInt((f + "00").slice(0, 2))).toString();
}

export function QuoteForm({ rfqId, vendors, lines }: {
  rfqId: string;
  vendors: Array<{ id: string; code: string; name: string }>;
  lines: Array<{ materialId: string; materialName: string; qty: string | number }>;
}) {
  const router = useRouter();
  const first = lines[0];
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [deliveryDays, setDays] = useState("14");
  const [qty, setQty] = useState(String(first?.qty ?? "1"));
  const [rate, setRate] = useState("350");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!first) return;
    setBusy(true); setError(null);
    try {
      await browserApi().post(`/v1/procurement/rfqs/${rfqId}/quotes`, {
        vendorId,
        deliveryDays: Number(deliveryDays),
        lines: [{ materialId: first.materialId, qty: Number(qty), ratePaise: rupeesToPaise(rate) }],
      });
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-4 grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-5" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <select required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
        {vendors.map((v) => <option key={v.id} value={v.id}>{v.code} · {v.name}</option>)}
      </select>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Delivery days" value={deliveryDays} onChange={(e) => setDays(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Qty" value={qty} onChange={(e) => setQty(e.target.value)} />
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="Rate ₹" value={rate} onChange={(e) => setRate(e.target.value)} />
      <button type="submit" disabled={busy || !vendorId || !first} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Saving…" : "Record quote"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}

export function AwardForm({ rfqId, quotes, projects }: {
  rfqId: string;
  quotes: Array<{ quoteId: string; vendorId: string; rank: number }>;
  projects: Array<{ id: string; code: string }>;
}) {
  const router = useRouter();
  const [quoteId, setQuoteId] = useState(quotes[0]?.quoteId ?? "");
  const [poNo, setPoNo] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [promised, setPromised] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await browserApi().post(`/v1/procurement/rfqs/${rfqId}/award`, {
        quoteId, poNo, projectId,
        promisedDate: promised ? new Date(promised + "T00:00:00.000Z").toISOString() : undefined,
      });
      router.push("/procurement/pos");
      router.refresh();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-4 grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-5" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <select required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
        {quotes.map((q) => <option key={q.quoteId} value={q.quoteId}>L{q.rank} · {q.vendorId.slice(0, 8)}</option>)}
      </select>
      <input required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} placeholder="PO no" value={poNo} onChange={(e) => setPoNo(e.target.value)} />
      <select required className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
      </select>
      <input type="date" className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} value={promised} onChange={(e) => setPromised(e.target.value)} />
      <button type="submit" disabled={busy || !quoteId || !projectId} className="rounded px-3 py-2 text-sm text-white" style={{ background: "var(--bo-primary)" }}>{busy ? "Awarding…" : "Award PO"}</button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
