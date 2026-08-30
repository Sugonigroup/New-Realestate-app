"use client";

import React, { useState } from "react";

interface RiskItem {
  id: string;
  riskNo: string;
  title: string;
  category: string;
  probability: number;
  impact: number;
  riskScore: number;
  ownerRole: string;
  status: "open" | "mitigated" | "closed";
}

const INITIAL_RISKS: RiskItem[] = [
  {
    id: "rsk-1",
    riskNo: "RSK-2026-001",
    title: "Cement & Steel Commodity Price Inflation",
    category: "financial",
    probability: 4,
    impact: 4,
    riskScore: 16, // Critical RED
    ownerRole: "procurement_manager",
    status: "open",
  },
  {
    id: "rsk-2",
    riskNo: "RSK-2026-004",
    title: "RERA QPR Filing Delay Penalty Risk",
    category: "compliance",
    probability: 2,
    impact: 5,
    riskScore: 10, // High AMBER
    ownerRole: "compliance_officer",
    status: "open",
  },
  {
    id: "rsk-3",
    riskNo: "RSK-2026-008",
    title: "Monsoon Site Dewatering System Backup",
    category: "safety",
    probability: 2,
    impact: 3,
    riskScore: 6, // Medium YELLOW
    ownerRole: "site_engineer",
    status: "mitigated",
  },
];

export default function OpsSupportRisksPage() {
  const [risks] = useState<RiskItem[]>(INITIAL_RISKS);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Enterprise Risk Matrix & CSAT Metrics</h1>
          <p className="text-sm text-slate-600">5x5 Risk probability x impact heatmap, post-handover customer ticket SLA, and CSAT</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
          + Log New Risk
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Critical Heatmap Risks</div>
          <div className="text-xl font-bold text-rose-700 mt-1">1 Open (Score &ge; 15)</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">High Risk Items</div>
          <div className="text-xl font-bold text-amber-700 mt-1">1 Open (Score 10-14)</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Customer CSAT Rating</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">4.5 / 5.0 (90% SLA)</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Audit CAPA Status</div>
          <div className="text-xl font-bold text-slate-900 mt-1">100% Verified</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">Risk No</th>
              <th className="p-3">Title</th>
              <th className="p-3">Category</th>
              <th className="p-3">Prob x Impact</th>
              <th className="p-3">Risk Score</th>
              <th className="p-3">Owner</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {risks.map((rsk) => (
              <tr key={rsk.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{rsk.riskNo}</td>
                <td className="p-3 font-medium text-slate-900">{rsk.title}</td>
                <td className="p-3 text-xs capitalize text-slate-600">{rsk.category}</td>
                <td className="p-3 font-mono text-slate-700">
                  {rsk.probability} &times; {rsk.impact}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                      rsk.riskScore >= 15
                        ? "bg-rose-100 text-rose-800"
                        : rsk.riskScore >= 10
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {rsk.riskScore} ({rsk.riskScore >= 15 ? "CRITICAL" : rsk.riskScore >= 10 ? "HIGH" : "MEDIUM"})
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-600 font-mono">{rsk.ownerRole}</td>
                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 capitalize">
                    {rsk.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3 py-1 rounded transition font-medium">
                    Mitigation Plan
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
