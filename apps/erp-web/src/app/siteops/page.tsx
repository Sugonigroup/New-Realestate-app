"use client";

import React, { useState } from "react";

interface RaBillItem {
  id: string;
  billNo: string;
  contractorName: string;
  period: string;
  grossValPaise: bigint;
  retentionPaise: bigint;
  tdsPaise: bigint;
  netPayablePaise: bigint;
  status: "submitted" | "certified" | "paid";
}

const INITIAL_BILLS: RaBillItem[] = [
  {
    id: "rab-1",
    billNo: "RA-2026-081",
    contractorName: "Shree Ram Masonry & Plaster",
    period: "2026-08",
    grossValPaise: 10_00_000_00n, // ₹10.00 Lakh
    retentionPaise: 50_000_00n, // 5% = ₹50,000
    tdsPaise: 19_000_00n, // 2% 194C = ₹19,000
    netPayablePaise: 8_31_000_00n, // ₹8.31 Lakh
    status: "certified",
  },
  {
    id: "rab-2",
    billNo: "RA-2026-082",
    contractorName: "Quality Steel Fabricators",
    period: "2026-08",
    grossValPaise: 25_00_000_00n, // ₹25.00 Lakh
    retentionPaise: 1_25_000_00n, // 5% = ₹1.25 Lakh
    tdsPaise: 47_500_00n, // 2% 194C = ₹47,500
    netPayablePaise: 20_77_500_00n, // ₹20.77 Lakh
    status: "submitted",
  },
];

export default function SiteOpsPage() {
  const [bills] = useState<RaBillItem[]>(INITIAL_BILLS);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Site Operations & Construction EPC</h1>
          <p className="text-sm text-slate-600">Subcontractor RA Bill certification, Concrete Pour Cards (M30/M40), and HSE Permit-to-Work (PTW)</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded-md font-medium transition">
            + Issue PTW Permit
          </button>
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded-md font-medium transition">
            + Create Pour Card
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
            + Submit Subcontractor RA Bill
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross RA Billed (Aug)</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹35.00 Lakh</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Retention Retained (5%)</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">₹1.75 Lakh</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pour Cards Approved</div>
          <div className="text-xl font-bold text-slate-900 mt-1">12 Pours (100% Cleared)</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">HSE Site Safety Rating</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">95 / 100 (EXCELLENT)</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 font-bold text-slate-800 text-sm">
          Subcontractor Running Account (RA) Bills
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">RA Bill No</th>
              <th className="p-3">Contractor Name</th>
              <th className="p-3">Period</th>
              <th className="p-3">Gross Billed</th>
              <th className="p-3">Retention (5%)</th>
              <th className="p-3">TDS 194C</th>
              <th className="p-3">Net Payable</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{bill.billNo}</td>
                <td className="p-3 font-medium text-slate-900">{bill.contractorName}</td>
                <td className="p-3 text-xs text-slate-600 font-mono">{bill.period}</td>
                <td className="p-3 font-mono text-slate-900">
                  ₹{(Number(bill.grossValPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 font-mono text-emerald-700">
                  ₹{(Number(bill.retentionPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 font-mono text-slate-600">
                  ₹{(Number(bill.tdsPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 font-mono font-bold text-slate-900">
                  ₹{(Number(bill.netPayablePaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      bill.status === "certified"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {bill.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1 rounded transition font-medium">
                    Certify Bill
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
