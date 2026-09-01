import { MoneyText } from "@buildos/ui";
import { asPaise, loadList } from "@/lib/load";
import ActForm from "./act-form";
import StartWorkflowForm from "./start-form";

interface Task {
  id: string;
  state: string;
  assignedRole: string;
  slaDue: string;
  instance?: { action: string; valuePaise: string };
}

/** Inbox from GET /v1/workflows/my-tasks. */
export default async function ApprovalsPage() {
  const rows = await loadList<Task>("/v1/workflows/my-tasks");

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Approvals inbox</h1>
      <StartWorkflowForm />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{t.instance?.action ?? t.id}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {t.assignedRole} · SLA {new Date(t.slaDue).toLocaleString("en-IN")} · {t.state}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {t.instance?.valuePaise != null && <MoneyText paise={asPaise(t.instance.valuePaise)} />}
              <ActForm taskId={t.id} />
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No pending tasks.</div>}
      </div>
    </main>
  );
}
