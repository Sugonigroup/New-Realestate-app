"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api";
import { HR_NAV, Subnav } from "@/app/subnav";

/** Geo check-in from POST /v1/hr/attendance/check-in. */
export default function AttendancePage() {
  const [employeeId, setEmp] = useState("");
  const [deviceId, setDevice] = useState("web");
  const [lat, setLat] = useState("12.9716");
  const [lng, setLng] = useState("77.5946");
  const [radius, setRadius] = useState("250");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const geoLat = Number(lat);
      const geoLng = Number(lng);
      await browserApi().post("/v1/hr/attendance/check-in", {
        employeeId,
        deviceId,
        geoLat,
        geoLng,
        fenceCenter: { lat: geoLat, lng: geoLng },
        fenceRadiusMeters: Number(radius),
      });
      setOk("Checked in");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Attendance check-in</h1>
      <Subnav items={HR_NAV} />
      <form onSubmit={submit} className="grid max-w-xl grid-cols-2 gap-3">
        <input required placeholder="Employee id" value={employeeId} onChange={(e) => setEmp(e.target.value)} className="col-span-2 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Device id" value={deviceId} onChange={(e) => setDevice(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Fence m" value={radius} onChange={(e) => setRadius(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Lat" value={lat} onChange={(e) => setLat(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <input required placeholder="Lng" value={lng} onChange={(e) => setLng(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        <button type="submit" disabled={busy} className="col-span-2 rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy ? "Checking in…" : "Check in"}
        </button>
        {error && <p className="col-span-2 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
        {ok && <p className="col-span-2 text-sm" style={{ color: "var(--bo-success)" }}>{ok}</p>}
      </form>
    </main>
  );
}
