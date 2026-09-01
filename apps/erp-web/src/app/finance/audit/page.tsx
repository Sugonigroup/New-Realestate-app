import { cookies } from "next/headers";
import { serverApi } from "@/lib/api";

interface AuditEvent {
  id: string;
  actorKind: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export default async function FinanceAuditPage() {
  const token = (await cookies()).get("access_token")?.value;
  let events: AuditEvent[] = [];
  try {
    events = (await serverApi(token).get<AuditEvent[]>("/v1/gl/audit")) ?? [];
  } catch { /* degraded */ }

  return (
    <main className="p-6">
      <h2 className="mb-1 text-lg font-semibold">Finance audit</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--bo-text-muted)" }}>
        Journal post/reverse, period close, AP match, bank match. Posted amounts never change in place.
      </p>
      <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--bo-border)" }}>
        {events.map((e) => (
          <div key={e.id} className="flex items-center justify-between border-b px-4 py-3 text-sm last:border-b-0" style={{ borderColor: "var(--bo-border)", background: "var(--bo-surface)" }}>
            <div>
              <div className="font-medium">{e.action}</div>
              <div className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{e.entityType} {e.entityId ?? ""} · {e.actorKind}</div>
            </div>
            <span className="text-xs" style={{ color: "var(--bo-text-muted)" }}>{new Date(e.createdAt).toLocaleString("en-IN")}</span>
          </div>
        ))}
        {events.length === 0 && <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--bo-text-muted)" }}>No GL audit events yet.</div>}
      </div>
    </main>
  );
}
