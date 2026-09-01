"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function MoveForms({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [fromId, setFrom] = useState(projectId ?? "");
  const [toId, setTo] = useState("");
  const [materialId, setMat] = useState("");
  const [qty, setQty] = useState("1");
  const [refDocNo, setRef] = useState("");
  const [countNo, setCountNo] = useState("");
  const [countedQty, setCounted] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"xfer" | "count" | "adj" | null>(null);

  async function transfer() {
    setBusy("xfer");
    setError(null);
    try {
      await browserApi().post("/v1/siteops/inventory/transfers", {
        fromProjectId: fromId, toProjectId: toId, materialId, qty: Number(qty), refDocNo,
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function count() {
    setBusy("count");
    setError(null);
    try {
      await browserApi().post("/v1/siteops/inventory/counts", {
        countNo, projectId: fromId, materialId, countedQty: Number(countedQty),
      });
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function adjust() {
    setBusy("adj");
    setError(null);
    try {
      await browserApi().post(`/v1/siteops/inventory/counts/${encodeURIComponent(countNo)}/adjust`, {});
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>From / count project
        <input placeholder="uuid" value={fromId} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>To project
        <input placeholder="uuid" value={toId} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>Material id
        <input value={materialId} onChange={(e) => setMat(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>Transfer qty
        <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>Transfer ref
        <input value={refDocNo} onChange={(e) => setRef(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <button type="button" disabled={busy !== null} onClick={() => void transfer()} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy === "xfer" ? "…" : "Transfer"}
      </button>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>Count no
        <input value={countNo} onChange={(e) => setCountNo(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="text-xs" style={{ color: "var(--bo-text-muted)" }}>Counted qty
        <input inputMode="decimal" value={countedQty} onChange={(e) => setCounted(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={busy !== null} onClick={() => void count()} className="flex-1 rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy === "count" ? "…" : "Count"}
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void adjust()} className="flex-1 rounded px-3 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
          {busy === "adj" ? "…" : "Adjust"}
        </button>
      </div>
      {error && <p className="col-span-full text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </div>
  );
}
