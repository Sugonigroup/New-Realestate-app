"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataTable } from "@buildos/ui";
import type { ColumnDef } from "@tanstack/react-table";
import { browserApi } from "@/lib/api";
import { SALES_NAV, Subnav } from "@/app/subnav";

interface Booking {
  id: string;
  customerName: string;
  unitId: string;
  status: string;
  totalPaise: string;
  discountPaise: string;
  discountPct: string;
  aftStatus: string;
}

const columns: ColumnDef<Booking, unknown>[] = [
  { accessorKey: "customerName", header: "Customer" },
  {
    accessorKey: "totalPaise",
    header: "Agreement value",
    cell: ({ row }) => {
      const b = row.original;
      const net = BigInt(b.totalPaise) - BigInt(b.discountPaise ?? 0);
      return `₹${(Number(net) / 1e7).toFixed(2)} Cr`;
    },
  },
  { accessorKey: "discountPct", header: "Discount %" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "aftStatus", header: "AFT" },
  {
    id: "open",
    header: "",
    cell: ({ row }) => (
      <Link href={`/sales/bookings/new?unitId=${row.original.unitId}`} style={{ color: "var(--bo-primary)" }}>
        manage →
      </Link>
    ),
  },
];

/** Bookings list (U1) — client component: cell renderers can't cross the RSC boundary. */
export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  useEffect(() => {
    browserApi().get<Booking[]>("/v1/bookings").then(setBookings).catch(() => {});
  }, []);

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Bookings</h1>
        <Link href="/sales/inventory" className="text-sm" style={{ color: "var(--bo-primary)" }}>
          New booking from inventory →
        </Link>
      </div>
      <Subnav items={SALES_NAV} />
      <DataTable<Booking> data={bookings} columns={columns} />
    </main>
  );
}
