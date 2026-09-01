import { loadList } from "@/lib/load";
import { HR_NAV, Subnav } from "@/app/subnav";

interface MusterRow {
  contractorId: string;
  trade: string;
  headcount: number;
  date?: string;
}

/** Contractor muster from GET /v1/hr/muster. */
export default async function MusterPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const rows = projectId ? await loadList<MusterRow>(`/v1/hr/muster?projectId=${projectId}`) : [];

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Muster</h1>
      <Subnav items={HR_NAV} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Project ID</label>
          <input name="projectId" defaultValue={projectId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      {projectId && (
        <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
          {rows.map((r, i) => (
            <div key={`${r.contractorId}-${r.trade}-${i}`} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
              <div>
                <div className="font-medium">{r.trade}</div>
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{r.contractorId}</div>
              </div>
              <span>{r.headcount}</span>
            </div>
          ))}
          {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No muster rows.</div>}
        </div>
      )}
    </main>
  );
}
