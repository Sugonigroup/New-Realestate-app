import { loadList } from "@/lib/load";
import Link from "next/link";
import UploadForm from "./upload-form";
import { PROJECT_NAV, Subnav } from "@/app/subnav";

interface Doc {
  id: string;
  name: string;
  folderPath: string;
  docClass: string;
  currentVersion: number;
  projectId: string | null;
}

/** Document vault from GET /v1/documents. */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const q = projectId ? `?projectId=${projectId}` : "";
  const rows = await loadList<Doc>(`/v1/documents${q}`);

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Documents</h1>
      <Subnav items={PROJECT_NAV} />
      <UploadForm projectId={projectId} />
      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Project ID (optional)</label>
          <input name="projectId" defaultValue={projectId ?? ""} className="w-72 rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--bo-border)" }} />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>Filter</button>
      </form>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((d) => (
          <div key={d.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{d.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{d.folderPath} · {d.docClass}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs">v{d.currentVersion}</span>
              <Link href={`/documents/${d.id}`} className="text-xs" style={{ color: "var(--bo-primary)" }}>preview</Link>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No documents.</div>}
      </div>
    </main>
  );
}
