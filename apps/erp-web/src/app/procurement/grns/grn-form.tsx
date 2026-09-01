"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

interface PostedGrn {
  id: string;
  grnNo: string;
  status: string;
  lines: Array<{ qty: string | number; acceptedQty: string | number; rejectedQty: string | number }>;
}

function toIso(local: string): string {
  if (!local) return new Date().toISOString();
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

export default function GrnForm({
  defaults,
}: {
  defaults: { orderId?: string; projectId?: string; poLineId?: string };
}) {
  const router = useRouter();
  const [grnNo, setGrnNo] = useState("");
  const [orderId, setOrderId] = useState(defaults.orderId ?? "");
  const [projectId, setProjectId] = useState(defaults.projectId ?? "");
  const [poLineId, setPoLineId] = useState(defaults.poLineId ?? "");
  const [receivedAt, setReceivedAt] = useState("");
  const [qty, setQty] = useState("1");
  const [acceptedQty, setAccepted] = useState("1");
  const [rejectedQty, setRejected] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<PostedGrn | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setPosted(null);
    const received = Number(qty);
    const accepted = Number(acceptedQty);
    const rejected = rejectedQty === "" ? undefined : Number(rejectedQty);
    try {
      const result = await browserApi().post<PostedGrn>("/v1/procurement/grns", {
        grnNo,
        orderId,
        projectId,
        receivedAt: toIso(receivedAt),
        lines: [{
          poLineId,
          qty: received,
          acceptedQty: accepted,
          rejectedQty: rejected,
          remark: remark || undefined,
        }],
      });
      setPosted(result);
      setGrnNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid max-w-2xl grid-cols-2 gap-3 rounded-lg border p-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        GRN no
        <input required value={grnNo} onChange={(e) => setGrnNo(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Received at
        <input type="datetime-local" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Purchase order id
        <input required value={orderId} onChange={(e) => setOrderId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Project id
        <input required value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="col-span-2 block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        PO line id
        <input required value={poLineId} onChange={(e) => setPoLineId(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 font-mono text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Qty received
        <input required inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Accepted qty
        <input required inputMode="decimal" value={acceptedQty} onChange={(e) => setAccepted(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Rejected qty (optional)
        <input inputMode="decimal" placeholder="defaults to received − accepted" value={rejectedQty} onChange={(e) => setRejected(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <label className="block text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Remark
        <input value={remark} onChange={(e) => setRemark(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      </label>
      <p className="col-span-2 text-xs" style={{ color: "var(--bo-text-muted)" }}>
        Accepted + rejected must equal received. Receipts are immutable once posted; qty cannot exceed PO outstanding.
      </p>
      <button type="submit" disabled={busy} className="col-span-2 rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Posting…" : "Post GRN"}
      </button>
      {error && <p className="col-span-2 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      {posted && (
        <p className="col-span-2 text-sm" style={{ color: "var(--bo-success)" }}>
          Posted {posted.grnNo} ({posted.status}) · accepted {String(posted.lines[0]?.acceptedQty ?? "")} / rejected {String(posted.lines[0]?.rejectedQty ?? "")}
        </p>
      )}
    </form>
  );
}
