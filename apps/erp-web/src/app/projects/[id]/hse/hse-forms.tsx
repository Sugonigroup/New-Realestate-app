"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export function PermitForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [permitNo, setNo] = useState("");
  const [workType, setType] = useState("height_work");
  const [location, setLoc] = useState("");
  const [safetyOfficer, setSo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const from = new Date();
    const to = new Date(from.getTime() + 8 * 3600_000);
    try {
      await browserApi().post("/v1/siteops/hse/permits", {
        permitNo, projectId, workType, location, safetyOfficer,
        validFrom: from.toISOString(), validTo: to.toISOString(),
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
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <h3 className="text-sm font-medium">Request permit to work</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <input required placeholder="PTW no" value={permitNo} onChange={(e) => setNo(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <select value={workType} onChange={(e) => setType(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
          {["hot_work", "height_work", "excavation", "confined_space", "electrical"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input required placeholder="Location" value={location} onChange={(e) => setLoc(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Safety officer" value={safetyOfficer} onChange={(e) => setSo(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </div>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Request PTW"}
      </button>
    </form>
  );
}

export function ApprovePermitButton({ permitNo }: { permitNo: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function approve() {
    setBusy(true);
    try {
      await browserApi().post(`/v1/siteops/hse/permits/${encodeURIComponent(permitNo)}/approve`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" disabled={busy} onClick={approve} className="text-xs font-medium" style={{ color: "var(--bo-primary)" }}>
      {busy ? "…" : "Approve"}
    </button>
  );
}

export function IncidentForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [incidentNo, setNo] = useState("");
  const [severity, setSev] = useState(1);
  const [location, setLoc] = useState("");
  const [description, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/siteops/hse/incidents", { incidentNo, projectId, severity, location, description });
      setNo(""); setDesc(""); setLoc("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <h3 className="text-sm font-medium">Report incident</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <input required placeholder="INC no" value={incidentNo} onChange={(e) => setNo(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <select value={severity} onChange={(e) => setSev(Number(e.target.value))} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
          <option value={1}>1 near miss</option>
          <option value={2}>2 minor</option>
          <option value={3}>3 reportable</option>
          <option value={4}>4 major</option>
          <option value={5}>5 critical</option>
        </select>
        <input required placeholder="Location" value={location} onChange={(e) => setLoc(e.target.value)}
          className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </div>
      <textarea required placeholder="Description" value={description} onChange={(e) => setDesc(e.target.value)}
        className="w-full rounded border px-3 py-2 text-sm" rows={2} style={{ borderColor: "var(--bo-border)" }} />
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Log incident"}
      </button>
    </form>
  );
}
