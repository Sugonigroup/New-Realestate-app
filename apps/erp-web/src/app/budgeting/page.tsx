"use client";

import React, { useState } from "react";

interface BudgetVarianceItem {
  costCenter: string;
  accountCode: string;
  budgetPaise: bigint;
  actualPaise: bigint;
  variancePct: number;
  alert: "GREEN" | "AMBER" | "RED";
}

const VARIANCE_DATA: BudgetVarianceItem[] = [
  {
    costCenter: "CC-SITE-TOWER-A",
    accountCode: "5000-CEMENT-OPC",
    budgetPaise: 45_00_000_00n, // ₹45.00 Lakh
    actualPaise: 47_25_000_00n, // ₹47.25 Lakh
    variancePct: 5,
    alert: "GREEN",
  },
  {
    costCenter: "CC-SITE-TOWER-A",
    accountCode: "5000-LABOR-CONTRACT",
    budgetPaise: 30_00_000_00n, // ₹30.00 Lakh
    actualPaise: 33_60_000_00n, // ₹33.60 Lakh
    variancePct: 12,
    alert: "AMBER",
  },
  {
    costCenter: "CC-EXEC-OFFICE",
    accountCode: "5000-ADMIN-TRAVEL",
    budgetPaise: 5_00_000_00n, // ₹5.00 Lakh
    actualPaise: 6_25_000_00n, // ₹6.25 Lakh
    variancePct: 25,
    alert: "RED",
  },
];

export default function BudgetingVariancePage() {
  const [data] = useState<BudgetVarianceItem[]>(VARIANCE_DATA);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">FP&A Budget vs Actual Variance</h1>
          <p className="text-sm text-slate-600">Period variance monitoring against approved operating budgets with automated alerts</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded-md font-medium transition">
            Simulate Scenario
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
            + New Budget (FY27)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Period Budget</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹80.00 Lakh</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Period Actuals</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹87.10 Lakh</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Overall Variance</div>
          <div className="text-xl font-bold text-amber-700 mt-1">+8.87% (Amber)</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Red Flagged Line Items</div>
          <div className="text-xl font-bold text-rose-700 mt-1">1 Account (&gt;20%)</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">Cost Center</th>
              <th className="p-3">Account Code</th>
              <th className="p-3">Budgeted</th>
              <th className="p-3">Actual Spent</th>
              <th className="p-3">Variance %</th>
              <th className="p-3">Alert Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-slate-800">{item.costCenter}</td>
                <td className="p-3 font-mono text-xs text-slate-600">{item.accountCode}</td>
                <td className="p-3 font-mono text-slate-900">
                  ₹{(Number(item.budgetPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 font-mono text-slate-900 font-medium">
                  ₹{(Number(item.actualPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 font-mono font-semibold">
                  +{item.variancePct}%
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold ${
                      item.alert === "GREEN"
                        ? "bg-emerald-100 text-emerald-800"
                        : item.alert === "AMBER"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {item.alert} ({item.alert === "GREEN" ? "<10%" : item.alert === "AMBER" ? "10-20%" : ">20%"})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
