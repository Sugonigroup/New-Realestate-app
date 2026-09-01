import { loadList } from "@/lib/load";
import { CRM_NAV, Subnav } from "@/app/subnav";
import { PostButton } from "@/app/post-button";

interface Task {
  id: string;
  title: string;
  dueOn: string;
  status: string;
  leadId: string | null;
  oppNo: string | null;
}

/** Open CRM tasks from GET /v1/crm/tasks. */
export default async function CrmTasksPage() {
  const rows = await loadList<Task>("/v1/crm/tasks");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">CRM tasks</h1>
      <Subnav items={CRM_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((t) => (
          <div key={t.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{t.title}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {t.leadId ? `lead ${t.leadId.slice(0, 8)}` : t.oppNo ?? "unlinked"} · due {new Date(t.dueOn).toLocaleDateString("en-IN")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{t.status}</span>
              {t.status === "open" && <PostButton path={`/v1/crm/tasks/${t.id}/complete`} label="Done" />}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No open tasks.</div>}
      </div>
    </main>
  );
}
