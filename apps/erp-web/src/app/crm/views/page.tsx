import { loadList } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface SavedView {
  id: string;
  name: string;
  entityType: string;
  isShared: boolean;
  columns?: string[];
}

/** Saved CRM views from GET /v1/crm/views. */
export default async function CrmViewsPage() {
  const [leads, opps] = await Promise.all([
    loadList<SavedView>("/v1/crm/views?entityType=lead"),
    loadList<SavedView>("/v1/crm/views?entityType=opportunity"),
  ]);
  const rows = [...leads, ...opps];

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Saved views</h1>
      <Subnav items={CRM_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((v) => (
          <div key={v.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{v.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{v.entityType} · {(v.columns ?? []).join(", ") || "default columns"}</div>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{v.isShared ? "shared" : "mine"}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No saved views.</div>}
      </div>
    </main>
  );
}
