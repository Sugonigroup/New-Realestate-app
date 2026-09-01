"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

/** Row action: POST then refresh the RSC list. */
export function PostButton({
  path,
  body = {},
  label,
}: {
  path: string;
  body?: unknown;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await browserApi().post(path, body);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={busy} onClick={() => void run()} className="rounded px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "…" : label}
      </button>
      {error && <span className="max-w-40 truncate text-xs" style={{ color: "var(--bo-danger)" }}>{error}</span>}
    </span>
  );
}
