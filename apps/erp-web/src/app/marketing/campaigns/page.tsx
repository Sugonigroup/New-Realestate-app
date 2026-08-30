"use client";

import React, { useState } from "react";

interface CampaignItem {
  id: string;
  name: string;
  channel: "meta_ads" | "google_search" | "hoarding" | "newspaper" | "whatsapp";
  budgetPaise: bigint;
  spendPaise: bigint;
  leadsGenerated: number;
  bookingsConverted: number;
  cacPaise: bigint;
  status: "active" | "completed" | "paused";
}

const INITIAL_CAMPAIGNS: CampaignItem[] = [
  {
    id: "cmp-1",
    name: "Festive Pre-Launch - Tower A",
    channel: "meta_ads",
    budgetPaise: 5_00_000_00n, // ₹5.00 Lakh
    spendPaise: 3_80_000_00n, // ₹3.80 Lakh
    leadsGenerated: 340,
    bookingsConverted: 12,
    cacPaise: 31_666_00n, // ₹31,666 / booking
    status: "active",
  },
  {
    id: "cmp-2",
    name: "Airport Highway Billboard Hoardings",
    channel: "hoarding",
    budgetPaise: 15_00_000_00n, // ₹15.00 Lakh
    spendPaise: 15_00_000_00n, // ₹15.00 Lakh
    leadsGenerated: 180,
    bookingsConverted: 8,
    cacPaise: 1_87_500_00n, // ₹1,87,500 / booking
    status: "completed",
  },
];

export default function MarketingCampaignsPage() {
  const [campaigns] = useState<CampaignItem[]>(INITIAL_CAMPAIGNS);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Marketing & Campaign CAC Attribution</h1>
          <p className="text-sm text-slate-600">Multi-channel ad spend, lead attribution (first/last/linear), Customer Acquisition Cost (CAC), and ROI</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
          + Launch Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Ad Spend</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹18.80 Lakh</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Leads Attributed</div>
          <div className="text-xl font-bold text-slate-900 mt-1">520 Leads</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Converted Bookings</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">20 Units (3.8% Conv)</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average CAC</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹94,000 / unit</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">Campaign Name</th>
              <th className="p-3">Channel</th>
              <th className="p-3">Spend</th>
              <th className="p-3">Leads</th>
              <th className="p-3">Bookings</th>
              <th className="p-3">Blended CAC</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((cmp) => (
              <tr key={cmp.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{cmp.name}</td>
                <td className="p-3 text-xs uppercase font-mono text-slate-600">{cmp.channel.replace("_", " ")}</td>
                <td className="p-3 font-mono font-medium text-slate-900">
                  ₹{(Number(cmp.spendPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-slate-800 font-mono">{cmp.leadsGenerated}</td>
                <td className="p-3 font-mono font-bold text-emerald-700">{cmp.bookingsConverted}</td>
                <td className="p-3 font-mono text-slate-900">
                  ₹{(Number(cmp.cacPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      cmp.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {cmp.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3 py-1 rounded transition font-medium">
                    Attribution Breakdown
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
