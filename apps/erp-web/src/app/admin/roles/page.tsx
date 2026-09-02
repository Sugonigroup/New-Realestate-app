"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@buildos/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { browserApi } from "@/lib/api";
import { ADMIN_NAV, Subnav } from "@/app/subnav";

interface RoleRow { code: string; name: string; external: boolean; grants: string[]; denied: string[] }

const columns: ColumnDef<RoleRow, unknown>[] = [
  { accessorKey: "code", header: "Code" },
  { accessorKey: "name", header: "Role" },
  { id: "grants", header: "Grants", cell: ({ row }) => row.original.grants.join(", ") },
  { id: "denied", header: "Denied", cell: ({ row }) => row.original.denied.join(", ") || "—" },
];

/** Role matrix (U4, read-only view; edits via API). */
export default function RolesPage() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  useEffect(() => {
    browserApi().get<RoleRow[]>("/v1/admin/roles").then((r) => setRoles(r ?? [])).catch(() => {});
  }, []);
  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Role matrix</h1>
      <Subnav items={ADMIN_NAV} />
      <DataTable<RoleRow> data={roles} columns={columns} />
    </main>
  );
}
