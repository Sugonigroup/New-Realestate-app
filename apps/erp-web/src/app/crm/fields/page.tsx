import { loadOne } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

/** Custom field values from GET /v1/crm/custom-fields/values. */
export default async function CustomFieldsPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string; entityId?: string }>;
}) {
  const { entityType = "lead", entityId } = await searchParams;
  const values = entityId
    ? await loadOne<Record<string, string>>(`/v1/crm/custom-fields/values?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`)
    : null;
  const entries = Object.entries(values ?? {});

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Custom fields</h1>
      <Subnav items={CRM_NAV} />
      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Entity</label>
          <select name="entityType" defaultValue={entityType} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }}>
            <option value="lead">lead</option>
            <option value="opportunity">opportunity</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Entity ID</label>
          <input name="entityId" defaultValue={entityId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Load</button>
      </form>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <span className="font-medium">{k}</span>
            <span>{v}</span>
          </div>
        ))}
        {entityId && entries.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No field values.</div>}
      </div>
    </main>
  );
}
