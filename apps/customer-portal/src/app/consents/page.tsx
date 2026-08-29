"use client";

import { useEffect, useState } from "react";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";

/** DPDP consent center — grants/revocations feed the hub's suppression logic. */
export default function ConsentsPage() {
  const [rows, setRows] = useState<Array<{ channel: string; purpose: string; granted: boolean }>>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const token = document.cookie.split("; ").find((c) => c.startsWith("access_token="))?.split("=")[1];
    const res = await fetch(`${CORE_API}/v1/portal/consents`, {
      headers: { authorization: `Bearer ${token ?? ""}` },
    });
    if (res.ok) setRows((await res.json()) as typeof rows);
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(channel: string, purpose: string, granted: boolean) {
    setBusy(true);
    const token = document.cookie.split("; ").find((c) => c.startsWith("access_token="))?.split("=")[1];
    await fetch(`${CORE_API}/v1/portal/consents`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify({ channel, purpose, granted }),
    });
    await load();
    setBusy(false);
  }

  const promo = rows.find((r) => r.purpose === "promotional");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-xl font-semibold">Communication settings</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Payment and agreement updates are always sent (they keep your booking on track). Offers are opt-in and
        can be stopped anytime.
      </p>

      <div className="rounded-lg border p-4" style={{ background: "var(--bo-surface)", borderColor: "var(--bo-border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Offers & updates on WhatsApp</div>
            <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
              Festive offers, new launches, project milestones
            </div>
          </div>
          <button
            disabled={busy}
            onClick={() => toggle("whatsapp", "promotional", !promo?.granted)}
            className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            style={{ background: promo?.granted ? "var(--bo-danger)" : "var(--bo-success)" }}
          >
            {promo?.granted ? "Stop offers" : "Start offers"}
          </button>
        </div>
      </div>
      <a href="/" className="mt-6 inline-block text-sm" style={{ color: "var(--bo-primary)" }}>
        ← Back home
      </a>
    </main>
  );
}
