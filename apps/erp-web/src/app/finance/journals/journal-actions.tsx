"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export function JournalActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post() {
    setBusy(true); setErr(null);
    try {
      await browserApi().post(`/v1/gl/journals/${id}/post`, {});
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  async function reverse() {
    const reason = window.prompt("Reversal reason (posted journals cannot be edited)");
    if (!reason) return;
    setBusy(true); setErr(null);
    try {
      await browserApi().post(`/v1/gl/journals/${id}/reverse`, { reason });
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status === "draft" && (
        <button type="button" disabled={busy} onClick={() => void post()} className="text-xs" style={{ color: "var(--bo-primary)" }}>Post</button>
      )}
      {status === "posted" && (
        <button type="button" disabled={busy} onClick={() => void reverse()} className="text-xs" style={{ color: "var(--bo-danger)" }}>Reverse</button>
      )}
      {err && <span className="max-w-[12rem] text-right text-xs" style={{ color: "var(--bo-danger)" }}>{err}</span>}
    </div>
  );
}
