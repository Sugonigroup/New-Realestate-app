"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { browserApi } from "@/lib/api";

const CLP_MILESTONES = [
  { key: "booking", label: "On booking", percent: 10, trigger: { kind: "on_booking" } },
  { key: "agreement", label: "On AFT (15d)", percent: 10, trigger: { kind: "days_from_booking", days: 15 } },
  { key: "possession", label: "On possession", percent: 80, trigger: { kind: "construction_milestone", milestoneKey: "possession" } },
];

const PRICE_LIST = {
  baseRatePaise: "8200000", floorRisePaise: "150000", viewPremiumPaise: "0",
  plcPaise: "5000000", edcPaise: "7500000", idcPaise: "5000000",
  clubPaise: "10000000", corpusPaise: "6000000", gstRateBps: 500,
};

function WizardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const unitId = params.get("unitId") ?? "";
  const projectId = params.get("projectId") ?? "";

  const [step, setStep] = useState(1);
  const [customerName, setName] = useState("");
  const [customerPhone, setPhone] = useState("");
  const [sbaSqm, setSba] = useState("138.75");
  const [discountPct, setDiscount] = useState(0);
  const [totalPaise, setTotal] = useState<string | null>(null);
  const [holdId, setHoldId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const api = browserApi();

  async function step1(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const preview = await api.post<{ totalPaise: string }>("/v1/sales/price-preview", {
        priceList: PRICE_LIST, unit: { sbaSqm, floor: 0 },
      });
      setTotal(preview.totalPaise);
      const hold = await api.post<{ holdId: string }>("/v1/bookings", { unitId, holdHours: 24 });
      setHoldId(hold.holdId);
      setStep(2);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function step2(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const submitted = await api.post<{ bookingId: string; status: string }>("/v1/bookings/submit", {
        unitId, holdId, customerName, customerPhone,
        planCode: "CLP-STD", planType: "CLP", milestones: CLP_MILESTONES,
        totalPaise, discountPct,
      });
      setBookingId(submitted.bookingId);
      setStep(3);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function confirm() {
    setBusy(true); setError(null);
    try {
      await api.post(`/v1/bookings/${bookingId}/confirm`);
      router.push("/sales/bookings");
    } catch (err) { setError((err as Error).message); setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-1 text-xl font-semibold">Booking Wizard</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>Unit {unitId || "—"} · step {step}/3</p>

      {step === 1 && (
        <form onSubmit={step1} className="space-y-3">
          <input className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
            placeholder="Customer name" value={customerName} onChange={(e) => setName(e.target.value)} required />
          <input className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
            placeholder="+919876543210" value={customerPhone} onChange={(e) => setPhone(e.target.value)} required />
          <input className="w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
            placeholder="SBA sqm (e.g. 138.75)" value={sbaSqm} onChange={(e) => setSba(e.target.value)} required />
          {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
          <button type="submit" disabled={busy || !unitId}
            className="w-full rounded py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
            {busy ? "Working…" : "Price unit & hold 24h"}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={step2} className="space-y-3">
          <div className="rounded border p-3 text-sm" style={{ borderColor: "var(--bo-border)" }}>
            Agreement value: <strong>{totalPaise ? `₹${(Number(totalPaise) / 1e7).toFixed(2)} Cr` : "—"}</strong>
          </div>
          <label className="block text-sm">Discount % (0–12, needs approval above your tier)
            <input type="number" min={0} max={12} value={discountPct}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
          </label>
          {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
          <button type="submit" disabled={busy}
            className="w-full rounded py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
            {busy ? "Submitting…" : discountPct > 0 ? "Submit for approval" : "Submit booking"}
          </button>
        </form>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded border p-4 text-sm" style={{ borderColor: "var(--bo-border)" }}>
            Booking {bookingId} submitted.{" "}
            {discountPct > 0
              ? "Discount approval pending — confirm unlocks once approved."
              : "Ready to confirm."}
          </div>
          {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
          <button onClick={confirm} disabled={busy || discountPct > 0}
            className="w-full rounded py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-success)" }}>
            {busy ? "Confirming…" : "Confirm booking"}
          </button>
          <button onClick={() => router.push("/sales/bookings")} className="w-full text-sm" style={{ color: "var(--bo-primary)" }}>
            Go to bookings list
          </button>
        </div>
      )}
    </main>
  );
}

export default function BookingWizardPage() {
  return (
    <Suspense fallback={<main className="p-6">Loading…</main>}>
      <WizardInner />
    </Suspense>
  );
}
