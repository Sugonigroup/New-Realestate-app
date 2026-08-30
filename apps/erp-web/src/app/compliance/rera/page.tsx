import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";

const cr = (paise: string | number) => `₹${(Number(paise) / 1e7).toFixed(2)} Cr`;

interface QprDraft {
  profile: { authority: string; cadence: string };
  period: { year: number; period: string };
  autofillPct: number;
  manualGaps: string[];
  payload: { fields: Record<string, Record<string, unknown>>; sections: string[] };
  attachments: Array<{ kind: string; ref: string }>;
}

/** RERA project card (U4): state profile + auto-filled QPR draft + gaps. */
export default async function ReraPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; state?: string }>;
}) {
  const { projectId, state = "KA" } = await searchParams;
  const token = (await cookies()).get("access_token")?.value;
  let draft: QprDraft | null = null;
  let error: string | null = null;
  if (projectId) {
    try {
      draft = (await serverApi(token).get<QprDraft>(
        `/v1/compliance/qpr/draft?projectId=${projectId}&stateCode=${state}`,
      )) ?? null;
    } catch (e) { error = (e as Error).message; }
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">RERA compliance</h1>

      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Project ID</label>
          <input name="projectId" defaultValue={projectId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>State</label>
          <select name="state" defaultValue={state} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
            {["KA", "MH", "TN", "TG", "UP"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Draft QPR</button>
      </form>

      {error && <p style={{ color: "var(--bo-danger)" }}>{error}</p>}

      {draft && (
        <>
          <div className="mb-4 flex gap-4 text-sm">
            <span className="rounded px-2 py-1" style={{ background: "var(--bo-bg)" }}>{draft.profile.authority} · {draft.period.period} {draft.period.year} · {draft.profile.cadence}</span>
            <span className="rounded px-2 py-1" style={{ background: draft.autofillPct >= 90 ? "var(--bo-success)" : "var(--bo-warning)", color: "white" }}>
              auto-filled {draft.autofillPct}%
            </span>
          </div>
          {draft.manualGaps.length > 0 && (
            <ul className="mb-4 rounded border p-3 text-sm" style={{ borderColor: "var(--bo-warning)", color: "var(--bo-warning)" }}>
              {draft.manualGaps.map((g, i) => <li key={i}>⚠ {g}</li>)}
            </ul>
          )}
          <pre className="overflow-x-auto rounded-lg border p-4 text-xs" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            {JSON.stringify(draft.payload.fields, null, 2)}
          </pre>
        </>
      )}
    </main>
  );
}
