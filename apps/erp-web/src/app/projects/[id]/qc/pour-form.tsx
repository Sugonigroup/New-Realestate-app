"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export function PourCardForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pourNo, setNo] = useState("");
  const [locationElement, setLoc] = useState("");
  const [concreteGrade, setGrade] = useState("M30");
  const [targetVolumeCum, setVol] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/siteops/quality/pour-cards", {
        pourNo, projectId, locationElement, concreteGrade, targetVolumeCum: Number(targetVolumeCum),
      });
      setNo(""); setLoc("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <h3 className="text-sm font-medium">New pour card</h3>
      <div className="grid gap-3 md:grid-cols-4">
        <input required placeholder="Pour no" value={pourNo} onChange={(e) => setNo(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Element (Tower A slab 5)" value={locationElement} onChange={(e) => setLoc(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <select value={concreteGrade} onChange={(e) => setGrade(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
          {["M25", "M30", "M35", "M40", "M50"].map((g) => <option key={g}>{g}</option>)}
        </select>
        <input required type="number" min={0.1} step="0.1" value={targetVolumeCum} onChange={(e) => setVol(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </div>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Create pour card"}
      </button>
    </form>
  );
}

export function ClearanceButtons({ pourNo, card }: {
  pourNo: string;
  card: { rebarCleared: boolean; shutterCleared: boolean; mepCleared: boolean; qcCleared: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(field: "rebarCleared" | "shutterCleared" | "mepCleared" | "qcCleared") {
    setBusy(field);
    try {
      await browserApi().post(`/v1/siteops/quality/pour-cards/${encodeURIComponent(pourNo)}/clearances`, { [field]: true });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const gates: Array<{ key: "rebarCleared" | "shutterCleared" | "mepCleared" | "qcCleared"; label: string }> = [
    { key: "rebarCleared", label: "Rebar" },
    { key: "shutterCleared", label: "Shutter" },
    { key: "mepCleared", label: "MEP" },
    { key: "qcCleared", label: "QC" },
  ];

  return (
    <div className="flex flex-wrap gap-1">
      {gates.map((g) => (
        <button
          key={g.key}
          type="button"
          disabled={card[g.key] || busy === g.key}
          onClick={() => toggle(g.key)}
          className="rounded px-2 py-0.5 text-xs"
          style={{
            background: card[g.key] ? "var(--bo-success)" : "var(--bo-bg)",
            color: card[g.key] ? "white" : "var(--bo-text)",
            border: "1px solid var(--bo-border)",
          }}
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}
