import { loadList } from "@/lib/load";
import { OPS_NAV, Subnav } from "@/app/subnav";
import { PostButton } from "@/app/post-button";
import CapaForm from "./capa-form";

interface Finding {
  id: string;
  findingNo: string;
  auditedModule: string;
  title: string;
  severity: string;
  status: string;
  dueOn: string;
}

/** Internal audit findings from GET /v1/ops-support/findings. */
export default async function FindingsPage() {
  const rows = await loadList<Finding>("/v1/ops-support/findings");

  return (
    <main className="p-6">
      <h1 className="mb-1 text-xl font-semibold">Audit findings</h1>
      <Subnav items={OPS_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((f) => (
          <div key={f.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{f.findingNo} · {f.title}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                {f.auditedModule} · {f.severity} · due {new Date(f.dueOn).toLocaleDateString("en-IN")}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{f.status}</span>
              {f.status !== "closed" && (
                <>
                  <CapaForm findingNo={f.findingNo} />
                  <PostButton path={`/v1/ops-support/findings/${encodeURIComponent(f.findingNo)}/close`} label="Close" />
                </>
              )}
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No findings.</div>}
      </div>
    </main>
  );
}
