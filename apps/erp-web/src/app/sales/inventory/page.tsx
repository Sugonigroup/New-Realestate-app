import { cookies } from "next/headers";
import Link from "next/link";
import { serverApi } from "@/lib/api";

interface Unit {
  id: string;
  code: string;
  tower: string | null;
  floor: number | null;
  unitType: string | null;
  state: string;
}

const STATE_COLOR: Record<string, string> = {
  available: "var(--bo-success)",
  held: "var(--bo-warning)",
  blocked: "var(--bo-danger)",
  booked: "var(--bo-info)",
  registered: "var(--bo-text-muted)",
  cancelled: "var(--bo-border)",
};

/** Inventory Explorer (U1, 04 §4): unit-state color grid per project. */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  const token = (await cookies()).get("access_token")?.value;
  const api = serverApi(token);

  let units: Unit[] = [];
  let error: string | null = null;
  if (projectId) {
    try {
      units = (await api.get<Unit[]>(`/v1/bookings/units?projectId=${projectId}`)) ?? [];
    } catch (e) {
      error = (e as Error).message;
    }
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Inventory Explorer</h1>

      <form className="mb-6 flex items-end gap-3" method="get">
        <div>
          <label className="mb-1 block text-xs uppercase" style={{ color: "var(--bo-text-muted)" }}>Project ID</label>
          <input
            name="projectId"
            defaultValue={projectId ?? ""}
            className="w-72 rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}
            placeholder="paste a project id"
          />
        </div>
        <button type="submit" className="rounded px-4 py-2 text-sm font-medium text-white" style={{ background: "var(--bo-primary)" }}>
          Load
        </button>
      </form>

      {error && <p style={{ color: "var(--bo-danger)" }}>{error}</p>}

      {units.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-xs" style={{ color: "var(--bo-text-muted)" }}>
            {Object.entries(STATE_COLOR).map(([state, color]) => (
              <span key={state} className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded" style={{ background: color }} /> {state}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
            {units.map((u) => (
              <div
                key={u.id}
                className="rounded-lg border p-3 text-sm"
                style={{ borderColor: STATE_COLOR[u.state] ?? "var(--bo-border)", background: "var(--bo-surface)" }}
              >
                <div className="font-medium">{u.code}</div>
                <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>
                  {u.tower ?? "—"} · F{u.floor ?? "—"} · {u.unitType ?? ""}
                </div>
                <div className="mt-1 text-xs font-medium" style={{ color: STATE_COLOR[u.state] }}>
                  {u.state}
                </div>
                {u.state === "available" && (
                  <Link href={`/sales/bookings/new?unitId=${u.id}&projectId=${projectId ?? ""}`} className="mt-2 inline-block text-xs" style={{ color: "var(--bo-primary)" }}>
                    book →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {projectId && units.length === 0 && !error && (
        <p style={{ color: "var(--bo-text-muted)" }}>No units for this project.</p>
      )}
    </main>
  );
}
