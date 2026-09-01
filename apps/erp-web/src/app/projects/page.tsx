import Link from "next/link";
import { loadList } from "@/lib/load";
import { PROJECT_NAV, Subnav } from "@/app/subnav";

interface Project {
  id: string;
  code: string;
  name: string;
  status: string;
  city: string | null;
  reraNumber: string | null;
}

/** Project index from GET /v1/projects. */
export default async function ProjectsPage() {
  const rows = await loadList<Project>("/v1/projects");

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>
        <Link href="/siteops" className="text-sm" style={{ color: "var(--bo-primary)" }}>Site ops →</Link>
      </div>
      <Subnav items={PROJECT_NAV} />
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {rows.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0 hover:bg-zinc-50" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{p.code} · {p.name}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{p.city ?? "—"}{p.reraNumber ? ` · ${p.reraNumber}` : ""}</div>
            </div>
            <span className="rounded px-2 py-1 text-xs" style={{ background: "var(--bo-bg)" }}>{p.status}</span>
          </Link>
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No projects.</div>}
      </div>
    </main>
  );
}
