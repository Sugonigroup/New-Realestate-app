"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

function rupeesToPaise(rupees: string): string {
  return String(Math.round(Number(rupees) * 100));
}

export function ParcelForm() {
  const router = useRouter();
  const [parcelNo, setParcelNo] = useState("");
  const [surveyNo, setSurvey] = useState("");
  const [location, setLocation] = useState("");
  const [areaSqFt, setArea] = useState("");
  const [purchaseRupees, setPurchase] = useState("");
  const [titleStatus, setTitle] = useState("clear");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/land/parcels", {
        parcelNo, surveyNo, location, areaSqFt: Number(areaSqFt),
        purchaseValPaise: rupeesToPaise(purchaseRupees), titleStatus,
      });
      setParcelNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="Parcel no" value={parcelNo} onChange={(e) => setParcelNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Survey no" value={surveyNo} onChange={(e) => setSurvey(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Area sqft" value={areaSqFt} onChange={(e) => setArea(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Purchase ₹" value={purchaseRupees} onChange={(e) => setPurchase(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={titleStatus} onChange={(e) => setTitle(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        <option value="clear">clear</option>
        <option value="encumbered">encumbered</option>
        <option value="litigation">litigation</option>
      </select>
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Register parcel"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}

export function JdaForm() {
  const router = useRouter();
  const [jdaNo, setJdaNo] = useState("");
  const [landParcelId, setParcelId] = useState("");
  const [landownerName, setName] = useState("");
  const [loShare, setLo] = useState("40");
  const [devShare, setDev] = useState("60");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/land/jdas", {
        jdaNo, landParcelId, landownerName,
        landownerSharePct: Number(loShare), developerSharePct: Number(devShare),
      });
      setJdaNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <input required placeholder="JDA no" value={jdaNo} onChange={(e) => setJdaNo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Parcel id" value={landParcelId} onChange={(e) => setParcelId(e.target.value)} className="rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Landowner name" value={landownerName} onChange={(e) => setName(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="LO share %" value={loShare} onChange={(e) => setLo(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="decimal" placeholder="Dev share %" value={devShare} onChange={(e) => setDev(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Execute JDA"}
      </button>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
