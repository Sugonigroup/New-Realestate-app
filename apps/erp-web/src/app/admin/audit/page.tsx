import { cookies } from "next/headers";
import { DataTable } from "@buildos/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { serverApi } from "@/lib/api";
import { ADMIN_NAV, Subnav } from "@/app/subnav";

interface AuditEvent {
  id: string;
  actorKind: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

const columns: ColumnDef<AuditEvent, unknown>[] = [
  { accessorKey: "createdAt", header: "When" },
  { accessorKey: "actorKind", header: "Actor" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "entityType", header: "Entity" },
  { accessorKey: "entityId", header: "Entity ID" },
];

/** Audit viewer (U4, admin). */
export default async function AuditPage() {
  const token = (await cookies()).get("access_token")?.value;
  let events: AuditEvent[] = [];
  try {
    events = (await serverApi(token).get<AuditEvent[]>("/v1/admin/audit")) ?? [];
  } catch { /* degraded */ }
  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Audit log</h1>
      <Subnav items={ADMIN_NAV} />
      <DataTable<AuditEvent> data={events} columns={columns} />
    </main>
  );
}
