import { cookies } from "next/headers";
import Link from "next/link";
import { DataTable } from "@buildos/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { serverApi } from "@/lib/api";

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  source: string;
  status: string;
  score: number;
  slaRespondBy: string | null;
  firstRespondedAt: string | null;
}

const columns: ColumnDef<Lead, unknown>[] = [
  { accessorKey: "fullName", header: "Name" },
  { accessorKey: "phone", header: "Phone" },
  { accessorKey: "source", header: "Source" },
  { accessorKey: "status", header: "Stage" },
  { accessorKey: "score", header: "Score" },
  {
    id: "sla",
    header: "SLA",
    cell: ({ row }) => {
      const l = row.original;
      if (l.firstRespondedAt) return <span style={{ color: "var(--bo-success)" }}>responded</span>;
      if (!l.slaRespondBy) return "—";
      const breached = new Date(l.slaRespondBy).getTime() < Date.now();
      return <span style={{ color: breached ? "var(--bo-danger)" : "var(--bo-warning)" }}>{breached ? "BREACHED" : "open"}</span>;
    },
  },
  {
    id: "open",
    header: "",
    cell: ({ row }) => <Link href={`/crm/leads/${row.original.id}`} style={{ color: "var(--bo-primary)" }}>open →</Link>,
  },
];

/** Lead Inbox (U1, 04 §4): omnichannel list with SLA + score columns. */
export default async function CrmInboxPage() {
  const token = (await cookies()).get("access_token")?.value;
  let leads: Lead[] = [];
  try {
    leads = (await serverApi(token).get<Lead[]>("/v1/crm/leads")) ?? [];
  } catch { /* degraded */ }

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lead Inbox</h1>
        <Link href="/crm/leads/import" className="text-sm" style={{ color: "var(--bo-primary)" }}>
          Import CSV
        </Link>
      </div>
      <DataTable<Lead> data={leads} columns={columns} />
    </main>
  );
}
