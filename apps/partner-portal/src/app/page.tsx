"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CORE_API = process.env.NEXT_PUBLIC_CORE_API ?? "http://localhost:8080";

export default function PartnerLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    fetch(`${CORE_API}/v1/partners/${code}/dashboard`)
      .then((r) => (r.ok ? router.push(`/dashboard?code=${code}`) : Promise.reject(new Error("Partner code not found or inactive"))))
      .catch((err: Error) => setError(err.message));
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-[360px] rounded-lg border p-6" style={{ background: "var(--bo-surface)", borderColor: "var(--bo-border)" }}>
        <h1 className="mb-1 text-xl font-semibold">Partner Portal</h1>
        <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>Enter your partner code</p>
        <input className="mb-4 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}
          placeholder="Partner code" value={code} onChange={(e) => setCode(e.target.value)} required />
        {error && <p className="mb-4 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
        <button type="submit" className="w-full rounded py-2 font-medium text-white" style={{ background: "var(--bo-primary)" }}>
          Sign in
        </button>
      </form>
    </main>
  );
}
