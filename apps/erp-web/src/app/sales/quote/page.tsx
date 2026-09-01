"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api";
import { SALES_NAV, Subnav } from "@/app/subnav";

const PRICE_LIST = {
  baseRatePaise: "8200000",
  floorRisePaise: "150000",
  viewPremiumPaise: "0",
  plcPaise: "5000000",
  edcPaise: "7500000",
  idcPaise: "5000000",
  clubPaise: "10000000",
  corpusPaise: "6000000",
  gstRateBps: 500,
};

interface Line {
  label?: string;
  key?: string;
  formatted: string;
}

interface Preview {
  lines: Line[];
  totalFormatted: string;
  gstPaise: string;
  subtotalPaise: string;
}

/** Pre-booking quote from POST /v1/sales/price-preview. */
export default function QuotePage() {
  const [sbaSqm, setSba] = useState("138.75");
  const [floor, setFloor] = useState("0");
  const [hasView, setHasView] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const out = await browserApi().post<Preview>("/v1/sales/price-preview", {
        priceList: PRICE_LIST,
        unit: { sbaSqm, floor: Number(floor), hasView },
      });
      setPreview(out);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Price quote</h1>
      <Subnav items={SALES_NAV} />
      <form onSubmit={submit} className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>SBA sqm</label>
          <input value={sbaSqm} onChange={(e) => setSba(e.target.value)} className="w-32 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Floor</label>
          <input value={floor} onChange={(e) => setFloor(e.target.value)} className="w-24 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasView} onChange={(e) => setHasView(e.target.checked)} />
          View premium
        </label>
        <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy ? "Pricing…" : "Preview"}
        </button>
      </form>
      {error && <p className="mb-4 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      {preview && (
        <>
          <p className="mb-3 text-sm" style={{ color: "var(--bo-text-muted)" }}>Total {preview.totalFormatted}</p>
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
            {preview.lines.map((l, i) => (
              <div key={l.key ?? `${l.label}-${i}`} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
                <span>{l.label ?? l.key}</span>
                <span>{l.formatted}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
