"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  return raw.startsWith("+") ? raw : `+${digits}`;
}

/** Buyer OTP login: POST /v1/portal/otp/send + verify. Cookie is portal_access_token. */
export default function PortalLoginPage() {
  const router = useRouter();
  const [tenantSlug, setTenant] = useState("shree-developers");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE_API}/v1/portal/otp/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: toE164(phone), tenantSlug }),
      });
      if (!res.ok) {
        const problem = (await res.json()) as { title?: string };
        throw new Error(problem.title ?? "OTP send failed");
      }
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE_API}/v1/portal/otp/verify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: toE164(phone), code, tenantSlug }),
      });
      if (!res.ok) {
        const problem = (await res.json()) as { title?: string };
        throw new Error(problem.title ?? "OTP verify failed");
      }
      const tokens = (await res.json()) as { accessToken: string };
      document.cookie = `portal_access_token=${tokens.accessToken}; path=/; max-age=900; samesite=strict`;
      router.push("/portal/home");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={sent ? verify : send}
        className="w-[360px] rounded-lg border p-6"
        style={{ background: "var(--bo-surface)", borderColor: "var(--bo-border)" }}
      >
        <h1 className="mb-1 text-xl font-semibold">Buyer portal</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          SMS OTP for a confirmed booking phone. Demo OTP is delivered through the notify hub.
        </p>
        <label className="mb-1 block text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>Organization</label>
        <input className="mb-4 w-full rounded border px-3 py-2" style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }} value={tenantSlug} onChange={(e) => setTenant(e.target.value)} />
        <label className="mb-1 block text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>Phone</label>
        <input className="mb-4 w-full rounded border px-3 py-2" style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }} placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        {sent && (
          <>
            <label className="mb-1 block text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>6-digit OTP</label>
            <input className="mb-4 w-full rounded border px-3 py-2 font-mono" style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }} inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          </>
        )}
        {error && <p className="mb-4 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded py-2 font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy ? "…" : sent ? "Verify" : "Send OTP"}
        </button>
      </form>
    </main>
  );
}
