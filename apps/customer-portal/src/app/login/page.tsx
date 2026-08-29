"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";
const TENANT = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "shree-developers";

export default function PortalLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, body: unknown) {
    const res = await fetch(`${CORE_API}/v1/portal/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const problem = (await res.json().catch(() => ({}))) as { title?: string };
      throw new Error(problem.title ?? "request failed");
    }
    return res.json();
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await call("otp/send", { phone });
      setSent(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const out = (await call("otp/verify", { phone, code })) as { accessToken: string };
      document.cookie = `access_token=${out.accessToken}; path=/; max-age=900; samesite=strict`;
      router.push("/");
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form
        onSubmit={sent ? verify : sendOtp}
        className="w-[360px] rounded-lg border p-6"
        style={{ background: "var(--bo-surface)", borderColor: "var(--bo-border)" }}
      >
        <h1 className="mb-1 text-xl font-semibold">BuildOS Home</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          {sent ? "Enter the 6-digit code sent to your WhatsApp/SMS" : "Sign in with your registered mobile number"}
        </p>
        {!sent && (
          <input
            className="mb-4 w-full rounded border px-3 py-2"
            style={{ borderColor: "var(--bo-border)" }}
            placeholder="+91 98765 43210"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        )}
        {sent && (
          <input
            className="mb-4 w-full rounded border px-3 py-2 tracking-widest"
            style={{ borderColor: "var(--bo-border)" }}
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        )}
        {error && <p className="mb-4 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded py-2 font-medium text-white disabled:opacity-50"
          style={{ background: "var(--bo-primary)" }}
        >
          {busy ? "Please wait…" : sent ? "Verify & sign in" : "Send OTP"}
        </button>
      </form>
    </main>
  );
}
