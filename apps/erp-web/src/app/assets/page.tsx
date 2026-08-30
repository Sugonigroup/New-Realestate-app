"use client";

import React, { useState } from "react";

interface AssetItem {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  status: "commissioned" | "in_service" | "in_maintenance" | "decommissioned";
  netBookValuePaise: bigint;
  currentMeterVal: number;
  meterUnit: string;
  mtbfHours: number;
  mttrHours: number;
}

const INITIAL_ASSETS: AssetItem[] = [
  {
    id: "ast-1",
    assetTag: "CRANE-01",
    name: "Tower Crane 10T",
    category: "heavy_machinery",
    status: "in_service",
    netBookValuePaise: 9_60_00_000_00n, // ₹9.60 Crore
    currentMeterVal: 1450,
    meterUnit: "hours",
    mtbfHours: 496,
    mttrHours: 4.0,
  },
  {
    id: "ast-2",
    assetTag: "EXCAV-02",
    name: "JCB Excavator 220",
    category: "heavy_machinery",
    status: "in_maintenance",
    netBookValuePaise: 3_80_00_000_00n, // ₹3.80 Crore
    currentMeterVal: 2100,
    meterUnit: "hours",
    mtbfHours: 320,
    mttrHours: 6.5,
  },
];

export default function AssetsCmmsPage() {
  const [assets] = useState<AssetItem[]>(INITIAL_ASSETS);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Asset Registry & Maintenance CMMS</h1>
          <p className="text-sm text-slate-600">Enterprise asset tracking, SLM depreciation schedules, and maintenance work orders</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded-md font-medium transition">
            + Record Meter Reading
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
            + Register Asset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Net Book Value</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹13.40 Cr</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">In-Service Fleet</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">1 Units (80%)</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">In-Maintenance Downtime</div>
          <div className="text-xl font-bold text-amber-700 mt-1">1 Breakdown Active</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fleet MTBF / MTTR</div>
          <div className="text-xl font-bold text-slate-900 mt-1">408h / 5.2h</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">Asset Tag</th>
              <th className="p-3">Name</th>
              <th className="p-3">Category</th>
              <th className="p-3">Meter Reading</th>
              <th className="p-3">Net Book Value</th>
              <th className="p-3">MTBF / MTTR</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assets.map((ast) => (
              <tr key={ast.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{ast.assetTag}</td>
                <td className="p-3 font-medium text-slate-900">{ast.name}</td>
                <td className="p-3 text-xs capitalize text-slate-600">{ast.category.replace("_", " ")}</td>
                <td className="p-3 font-mono text-slate-800">
                  {ast.currentMeterVal} {ast.meterUnit}
                </td>
                <td className="p-3 font-mono font-medium text-slate-900">
                  ₹{(Number(ast.netBookValuePaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 font-mono text-xs text-slate-700">
                  {ast.mtbfHours}h / {ast.mttrHours}h
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      ast.status === "in_service"
                        ? "bg-emerald-100 text-emerald-800"
                        : ast.status === "in_maintenance"
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {ast.status.replace("_", " ")}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1 rounded transition font-medium">
                    Work Orders
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
