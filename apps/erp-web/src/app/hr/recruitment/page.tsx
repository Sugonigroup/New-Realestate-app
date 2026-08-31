"use client";

import React, { useState } from "react";

interface CandidateItem {
  id: string;
  name: string;
  reqNo: string;
  position: string;
  source: string;
  stage: "applied" | "screening" | "interview" | "offer_sent" | "offer_accepted" | "joined" | "rejected";
  rating: number | null;
  offeredCtcLakh: number | null;
}

const STAGES: CandidateItem["stage"][] = [
  "applied",
  "screening",
  "interview",
  "offer_sent",
  "offer_accepted",
  "joined",
];

const INITIAL_CANDIDATES: CandidateItem[] = [
  { id: "c1", name: "Ravi Menon", reqNo: "REQ-2026-014", position: "Site Engineer", source: "portal", stage: "interview", rating: 4, offeredCtcLakh: null },
  { id: "c2", name: "Asha Nair", reqNo: "REQ-2026-014", position: "Site Engineer", source: "referral", stage: "offer_accepted", rating: 5, offeredCtcLakh: 10.0 },
  { id: "c3", name: "Vikram Desai", reqNo: "REQ-2026-015", position: "Sales Manager", source: "agency", stage: "screening", rating: null, offeredCtcLakh: null },
  { id: "c4", name: "Meera Joshi", reqNo: "REQ-2026-012", position: "Junior Architect", source: "walk_in", stage: "joined", rating: 4, offeredCtcLakh: 8.5 },
];

export default function HrRecruitmentPage() {
  const [candidates] = useState<CandidateItem[]>(INITIAL_CANDIDATES);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Recruitment Pipeline & Exits</h1>
          <p className="text-sm text-slate-600">Requisition approvals (maker-checker), candidate stage flow, offers with validity, and F&amp;F exit clearance</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded-md font-medium transition">
            Initiate Exit
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
            + New Requisition
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Requisitions</div>
          <div className="text-xl font-bold text-slate-900 mt-1">3 Active</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Joined This Quarter</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">1 Candidate</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Offers Pending Response</div>
          <div className="text-xl font-bold text-amber-700 mt-1">1 Sent</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Time to Join</div>
          <div className="text-xl font-bold text-slate-900 mt-1">27 Days</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">Candidate</th>
              <th className="p-3">Requisition</th>
              <th className="p-3">Position</th>
              <th className="p-3">Source</th>
              <th className="p-3">Rating</th>
              <th className="p-3">Offered CTC</th>
              <th className="p-3">Stage</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-medium text-slate-900">{c.name}</td>
                <td className="p-3 font-mono text-xs text-emerald-700">{c.reqNo}</td>
                <td className="p-3 text-slate-700">{c.position}</td>
                <td className="p-3 text-xs capitalize text-slate-600">{c.source.replace("_", " ")}</td>
                <td className="p-3 font-mono text-slate-800">{c.rating ? `${c.rating}/5` : "—"}</td>
                <td className="p-3 font-mono text-slate-900">{c.offeredCtcLakh ? `₹${c.offeredCtcLakh.toFixed(1)} L` : "—"}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                      c.stage === "joined"
                        ? "bg-emerald-100 text-emerald-800"
                        : c.stage === "rejected"
                        ? "bg-rose-100 text-rose-800"
                        : c.stage === "offer_accepted"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {c.stage.replace("_", " ")}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  {c.stage !== "joined" && c.stage !== "rejected" && (
                    <button className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1 rounded transition font-medium">
                      Advance Stage
                    </button>
                  )}
                  {c.stage === "interview" && (
                    <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1 rounded transition font-medium">
                      Issue Offer
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
