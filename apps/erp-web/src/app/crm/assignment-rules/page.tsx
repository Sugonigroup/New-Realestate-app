import { loadList } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";

interface Rule {
  id: string;
  name: string;
  priority: number;
  slaMinutes: number | null;
  assignToUsers: string[];
  criteria: Record<string, string | undefined>;
  active: boolean;
}

/** Assignment rules from GET /v1/crm/automation/assignment-rules. */
export default async function AssignmentRulesPage() {
  const rows = await loadList<Rule>("/v1/crm/automation/assignment-rules");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Assignment rules</h1>
      <Subnav items={CRM_NAV} />
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>First match wins by priority</p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">P{r.priority} · {r.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {Object.entries(r.criteria ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" · ") || "any lead"}
                {r.slaMinutes ? ` · SLA ${r.slaMinutes}m` : ""} · {r.assignToUsers?.length ?? 0} assignees
              </div>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{r.active ? "active" : "off"}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No rules.</div>}
      </div>
    </main>
  );
}
