import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";

interface Doc {
  id: string;
  name: string;
  folderPath: string;
  docClass: string;
  currentVersion: number;
  updatedAt: string;
}

/** Drawing register (04 §4, 11 §1): current GFC revisions from the document vault. */
export default async function DrawingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const token = (await cookies()).get("access_token")?.value;
  let docs: Doc[] = [];
  let error: string | null = null;
  try {
    docs = (await serverApi(token).get<Doc[]>(`/v1/documents?projectId=${projectId}&docClass=drawing`)) ?? [];
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Drawings / GFC</h2>
      <p className="mb-6 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Current revision only. Superseded drawings must not be referenced on RA bills.
      </p>
      {error && <p className="mb-4 text-sm" style={{ color: "var(--bo-danger)" }}>{error}</p>}
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--bo-surface)" }}>
              {["Name", "Folder", "Rev", "Updated"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium" style={{ color: "var(--bo-text-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id} className="border-t" style={{ borderColor: "var(--bo-border)" }}>
                <td className="px-3 py-2 font-medium">{d.name}</td>
                <td className="px-3 py-2" style={{ color: "var(--bo-text-muted)" }}>{d.folderPath}</td>
                <td className="px-3 py-2">v{d.currentVersion}</td>
                <td className="px-3 py-2">{new Date(d.updatedAt).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
            {docs.length === 0 && !error && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center" style={{ color: "var(--bo-text-muted)" }}>
                  No drawings filed. Upload via the document vault with class `drawing`.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
