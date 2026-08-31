"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";

export default function LoginPage() {
  const router = useRouter();
  const [tenantSlug, setTenant] = useState("shree-developers");
  const [email, setEmail] = useState("admin@shree.example");
  const [password, setPassword] = useState("Buildos@demo1");
  const [mfaCode, setMfa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${CORE_API}/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantSlug, email, password, mfaCode: mfaCode || undefined }),
      });
      if (!res.ok) {
        const problem = (await res.json()) as { title?: string };
        throw new Error(problem.title ?? "login failed");
      }
      const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
      // WP-0D: move to httpOnly server-set cookies; presence-only for the Phase 0 shell.
      document.cookie = `access_token=${tokens.accessToken}; path=/; max-age=900; samesite=strict`;
      document.cookie = `refresh_token=${tokens.refreshToken}; path=/; max-age=604800; samesite=strict`;
      router.push("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form
        onSubmit={submit}
        className="w-[360px] rounded-lg border p-6"
        style={{ background: "var(--bo-surface)", borderColor: "var(--bo-border)" }}
      >
        <h1 className="mb-1 text-xl font-semibold">BuildOS ERP</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
          Sign in to your organization
          <br />
          <span className="text-xs">
            Demo MFA: run <code>bash scripts/demo-code.sh</code> in the repo (rotates every 30s)
          </span>
        </p>
        <label className="mb-1 block text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
          Organization
        </label>
        <input
          className="mb-4 w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }}
          value={tenantSlug}
          onChange={(e) => setTenant(e.target.value)}
        />
        <label className="mb-1 block text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
          Email
        </label>
        <input
          className="mb-4 w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="mb-1 block text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
          Password
        </label>
        <input
          className="mb-4 w-full rounded border px-3 py-2"
          style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="mb-1 block text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
          MFA Code (6-digit, if enrolled)
        </label>
        <input
          className="mb-4 w-full rounded border px-3 py-2 font-mono"
          style={{ borderColor: "var(--bo-border)", background: "var(--bo-bg)" }}
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          value={mfaCode}
          onChange={(e) => setMfa(e.target.value.replace(/\D/g, ""))}
        />
        {error && (
          <p className="mb-4 text-sm" style={{ color: "var(--bo-danger)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded py-2 font-medium text-white disabled:opacity-50"
          style={{ background: "var(--bo-primary)" }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
