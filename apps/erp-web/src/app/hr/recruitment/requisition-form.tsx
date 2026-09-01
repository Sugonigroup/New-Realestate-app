"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { browserApi } from "@/lib/api";

export default function RequisitionForm() {
  const router = useRouter();
  const [reqNo, setReqNo] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDept] = useState("");
  const [headcount, setHc] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await browserApi().post("/v1/hr/recruitment/requisitions", {
        reqNo, position, department, headcount: Number(headcount),
      });
      setReqNo("");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 flex flex-wrap items-end gap-3">
      <input required placeholder="Req no" value={reqNo} onChange={(e) => setReqNo(e.target.value)} className="w-28 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Position" value={position} onChange={(e) => setPosition(e.target.value)} className="w-40 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required placeholder="Department" value={department} onChange={(e) => setDept(e.target.value)} className="w-36 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <input required inputMode="numeric" placeholder="HC" value={headcount} onChange={(e) => setHc(e.target.value)} className="w-16 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
      <button type="submit" disabled={busy} className="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50" style={{ background: "var(--bo-primary)" }}>
        {busy ? "Saving…" : "Raise req"}
      </button>
      {error && <p className="text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
    </form>
  );
}
