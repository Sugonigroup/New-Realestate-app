"use client";

import React, { useState } from "react";

interface ContractItem {
  id: string;
  contractNo: string;
  title: string;
  partyName: string;
  partyRole: string;
  status: "draft" | "active" | "closed";
  totalPaise: bigint;
  highRiskClausesCount: number;
  openClaimsCount: number;
}

const INITIAL_CONTRACTS: ContractItem[] = [
  {
    id: "ctr-1",
    contractNo: "CTR-2026-012",
    title: "Structural Concrete & Rebar Contract",
    partyName: "L&T Infrastructure Ltd.",
    partyRole: "contractor",
    status: "active",
    totalPaise: 45_00_00_000_00n, // ₹45.00 Crore
    highRiskClausesCount: 2,
    openClaimsCount: 1,
  },
  {
    id: "ctr-2",
    contractNo: "CTR-2026-015",
    title: "Electrical & MEP Turnkey Work",
    partyName: "Voltas Engineering",
    partyRole: "vendor",
    status: "draft",
    totalPaise: 12_80_00_000_00n, // ₹12.80 Crore
    highRiskClausesCount: 0,
    openClaimsCount: 0,
  },
];

export default function ContractsPage() {
  const [contracts] = useState<ContractItem[]>(INITIAL_CONTRACTS);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Legal Contracts & Obligations</h1>
          <p className="text-sm text-slate-600">Contract lifecycle, clause risk management, and claims exposure tracking</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
          + Draft Contract
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Contracts Value</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹45.00 Cr</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">High-Risk Clauses Tracked</div>
          <div className="text-xl font-bold text-amber-700 mt-1">2 Clauses</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Open Dispute Claims</div>
          <div className="text-xl font-bold text-rose-700 mt-1">1 Claim Active</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">Contract No</th>
              <th className="p-3">Title</th>
              <th className="p-3">Counterparty</th>
              <th className="p-3">Role</th>
              <th className="p-3">Total Value</th>
              <th className="p-3">Clause Risk</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {contracts.map((ctr) => (
              <tr key={ctr.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{ctr.contractNo}</td>
                <td className="p-3 font-medium text-slate-900">{ctr.title}</td>
                <td className="p-3 text-slate-700">{ctr.partyName}</td>
                <td className="p-3 text-xs capitalize text-slate-600">{ctr.partyRole}</td>
                <td className="p-3 font-mono font-medium text-slate-900">
                  ₹{(Number(ctr.totalPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3">
                  {ctr.highRiskClausesCount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                      {ctr.highRiskClausesCount} High Risk
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                      Low Risk
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      ctr.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {ctr.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3 py-1 rounded transition font-medium">
                    View Risk Profile
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
