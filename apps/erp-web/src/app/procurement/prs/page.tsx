"use client";

import React, { useState } from "react";

interface PrItem {
  id: string;
  reqNo: string;
  projectId: string;
  requestedBy: string;
  status: "draft" | "approved" | "converted";
  createdAt: string;
  itemCount: number;
  estTotalPaise: bigint;
}

const INITIAL_PRS: PrItem[] = [
  {
    id: "pr-1",
    reqNo: "PR-2026-089",
    projectId: "PRJ-TOWER-A",
    requestedBy: "eng.sharma@buildos.internal",
    status: "draft",
    createdAt: "2026-08-30",
    itemCount: 4,
    estTotalPaise: 45_00_000_00n, // ₹45.00 Lakh
  },
  {
    id: "pr-2",
    reqNo: "PR-2026-088",
    projectId: "PRJ-PLAZA-B",
    requestedBy: "site.patel@buildos.internal",
    status: "approved",
    createdAt: "2026-08-28",
    itemCount: 2,
    estTotalPaise: 12_50_000_00n, // ₹12.50 Lakh
  },
];

export default function PurchaseRequisitionsPage() {
  const [prs, setPrs] = useState<PrItem[]>(INITIAL_PRS);
  const [filter, setFilter] = useState<string>("all");

  const approvePr = (id: string) => {
    setPrs((prev) =>
      prev.map((pr) => (pr.id === id ? { ...pr, status: "approved" as const } : pr)),
    );
  };

  const filtered = prs.filter((pr) => (filter === "all" ? true : pr.status === filter));

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Requisitions (PR)</h1>
          <p className="text-sm text-slate-600">Requisitions raised by site engineers awaiting approval and RFQ conversion</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
          + Raise New PR
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {["all", "draft", "approved", "converted"].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition ${
              filter === st
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">PR Number</th>
              <th className="p-3">Project</th>
              <th className="p-3">Requested By</th>
              <th className="p-3">Items</th>
              <th className="p-3">Est. Total</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((pr) => (
              <tr key={pr.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{pr.reqNo}</td>
                <td className="p-3 text-slate-700">{pr.projectId}</td>
                <td className="p-3 text-slate-600 text-xs">{pr.requestedBy}</td>
                <td className="p-3 text-slate-700">{pr.itemCount} materials</td>
                <td className="p-3 font-mono font-medium text-slate-900">
                  ₹{(Number(pr.estTotalPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      pr.status === "approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : pr.status === "draft"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {pr.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  {pr.status === "draft" && (
                    <button
                      onClick={() => approvePr(pr.id)}
                      className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1 rounded transition font-medium"
                    >
                      Approve PR
                    </button>
                  )}
                  {pr.status === "approved" && (
                    <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1 rounded transition font-medium">
                      Issue RFQ
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
