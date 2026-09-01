"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function HseActions({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [permitNo, setPermit] = useState("");
  const [incidentNo, setInc] = useState("");
  const [location, setLoc] = useState("");
  const [workType, setType] = useState("hot_work");
  const [severity, setSev] = useState("3");
  const [description, setDesc] = useState("");
  const [safetyOfficer, setOfficer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function permit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      const from = new Date();
      const to = new Date(Date.now() + 86400000);
      await browserApi().post("/v1/siteops/hse/permits", {
        permitNo,
        projectId,
        workType,
        location,
        validFrom: from.toISOString(),
        validTo: to.toISOString(),
        safetyOfficer,
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function incident(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/siteops/hse/incidents", {
        incidentNo,
        projectId,
        severity: Number(severity),
        location,
        description,
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!projectId) return null;

  return (
    <div className="mt-8 grid gap-6 md:grid-cols-2">
      <form onSubmit={permit} className="grid gap-2 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
        <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Permit</div>
        <input required placeholder="Permit no" value={permitNo} onChange={(e) => setPermit(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <select value={workType} onChange={(e) => setType(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
          {["hot_work", "height_work", "excavation", "confined_space", "electrical"].map((w) => <option key={w}>{w}</option>)}
        </select>
        <input required placeholder="Location" value={location} onChange={(e) => setLoc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Safety officer" value={safetyOfficer} onChange={(e) => setOfficer(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <button type="submit" disabled={busy} className="rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>Request permit</button>
        {permitNo && (
          <button type="button" disabled={busy} onClick={() => void browserApi().post(`/v1/siteops/hse/permits/${encodeURIComponent(permitNo)}/approve`, {}).then(() => router.refresh()).catch((err: Error) => setError(err.message))} className="rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
            Approve permit
          </button>
        )}
      </form>
      <form onSubmit={incident} className="grid gap-2 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
        <div className="text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Incident</div>
        <input required placeholder="Incident no" value={incidentNo} onChange={(e) => setInc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Severity 1-5" value={severity} onChange={(e) => setSev(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Location" value={location} onChange={(e) => setLoc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Description" value={description} onChange={(e) => setDesc(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <button type="submit" disabled={busy} className="rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>Report incident</button>
      </form>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </div>
  );
}
