"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@buildos/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { browserApi } from "@/lib/api";

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

// Client component: cell renderers can't cross the server→client RSC boundary.
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
export default function CrmInboxPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    browserApi()
      .get<Lead[]>("/v1/crm/leads")
      .then(setLeads)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Lead Inbox</h1>
        <Link href="/crm/leads/import" className="text-sm" style={{ color: "var(--bo-primary)" }}>
          Import CSV
        </Link>
      </div>
      {error && <p style={{ color: "var(--bo-danger)" }}>{error}</p>}
      {leads.length === 0 && !error ? (
        <p style={{ color: "var(--bo-text-muted)" }}>No leads yet — capture some via the webhook or CSV import.</p>
      ) : (
        <DataTable<Lead> data={leads} columns={columns} />
      )}
    </main>
  );
}
