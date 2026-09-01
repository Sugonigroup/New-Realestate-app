"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function PourFollowup() {
  const router = useRouter();
  const [pourNo, setNo] = useState("");
  const [rebarCleared, setRebar] = useState(true);
  const [shutterCleared, setShut] = useState(true);
  const [mepCleared, setMep] = useState(true);
  const [qcCleared, setQc] = useState(true);
  const [sampleNo, setSample] = useState("");
  const [age, setAge] = useState("7");
  const [targetNmm2, setTarget] = useState("30");
  const [actualNmm2, setActual] = useState("32");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"clr" | "cube" | null>(null);

  async function clearances() {
    setBusy("clr");
    setError(null);
    try {
      await browserApi().post(`/v1/siteops/quality/pour-cards/${encodeURIComponent(pourNo)}/clearances`, {
        rebarCleared, shutterCleared, mepCleared, qcCleared,
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function cube() {
    setBusy("cube");
    setError(null);
    try {
      await browserApi().post(`/v1/siteops/quality/pour-cards/${encodeURIComponent(pourNo)}/cube-tests`, {
        sampleNo, testingAgeDays: Number(age), targetNmm2: Number(targetNmm2), actualNmm2: Number(actualNmm2),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6 grid max-w-xl grid-cols-2 gap-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <label className="col-span-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>Pour no
        <input required value={pourNo} onChange={(e) => setNo(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rebarCleared} onChange={(e) => setRebar(e.target.checked)} /> Rebar</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shutterCleared} onChange={(e) => setShut(e.target.checked)} /> Shutter</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mepCleared} onChange={(e) => setMep(e.target.checked)} /> MEP</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={qcCleared} onChange={(e) => setQc(e.target.checked)} /> QC</label>
      <button type="button" disabled={busy !== null} onClick={() => void clearances()} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy === "clr" ? "…" : "Record clearances"}
      </button>
      <input placeholder="Cube sample no" value={sampleNo} onChange={(e) => setSample(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <select value={age} onChange={(e) => setAge(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
        <option value="7">7 day</option>
        <option value="28">28 day</option>
      </select>
      <input inputMode="decimal" placeholder="Target N/mm²" value={targetNmm2} onChange={(e) => setTarget(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input inputMode="decimal" placeholder="Actual N/mm²" value={actualNmm2} onChange={(e) => setActual(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="button" disabled={busy !== null} onClick={() => void cube()} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy === "cube" ? "…" : "Record cube test"}
      </button>
      {error && <p className="col-span-2 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </div>
  );
}
