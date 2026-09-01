import { cookies } from "next/headers";
import Link from "next/link";
import { serverApi } from "@/lib/api";
import { ProjectNav } from "../project-nav";

interface ProjectHeader {
  id: string;
  code: string;
  name: string;
  city: string | null;
  status: string;
  reraNumber: string | null;
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = (await cookies()).get("access_token")?.value;
  let project: ProjectHeader | null = null;
  try {
    project = (await serverApi(token).get<ProjectHeader>(`/v1/projects/${id}`)) ?? null;
  } catch {
    /* degraded */
  }

  return (
    <div>
      <header className="border-b px-6 py-4" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
        <p className="text-xs uppercase tracking-wide" style={{ color: "var(--bo-text-muted)" }}>
          <Link href="/projects">Projects</Link>
          {project ? ` / ${project.code}` : ""}
        </p>
        <h1 className="text-xl font-semibold">{project?.name ?? "Project"}</h1>
        <p className="text-sm" style={{ color: "var(--bo-text-muted)" }}>
          {project?.city ?? "—"} · {project?.status?.replaceAll("_", " ") ?? "unknown"} · RERA {project?.reraNumber ?? "—"}
        </p>
        <ProjectNav projectId={id} />
      </header>
      {children}
    </div>
  );
}
