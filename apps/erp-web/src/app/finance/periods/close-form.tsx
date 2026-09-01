"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export function CloseForm({ period, disabled }: { period: string; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function close(mode: "soft" | "hard") {
    setBusy(true); setErr(null);
    try {
      await browserApi().post(`/v1/gl/periods/${period}/close`, { mode });
      router.refresh();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (disabled) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void close("soft")} className="text-xs" style={{ color: "var(--bo-warning)" }}>Soft close</button>
        <button type="button" disabled={busy} onClick={() => void close("hard")} className="text-xs" style={{ color: "var(--bo-danger)" }}>Hard close</button>
      </div>
      {err && <span className="max-w-xs text-right text-xs" style={{ color: "var(--bo-danger)" }}>{err}</span>}
    </div>
  );
}
