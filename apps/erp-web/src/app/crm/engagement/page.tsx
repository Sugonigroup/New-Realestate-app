"use client";

import React, { useState } from "react";

interface EngagementMoment {
  id: string;
  personName: string;
  personType: "customer" | "lead" | "partner" | "employee";
  eventType: string;
  eventDate: string;
  language: string;
  channel: string;
  status: "planned" | "approved" | "sent" | "suppressed";
  suppressionReason?: string;
  consent: "granted" | "revoked" | "unknown";
}

const TODAY_MOMENTS: EngagementMoment[] = [
  { id: "e1", personName: "Rajesh Patil", personType: "customer", eventType: "Birthday", eventDate: "2026-09-01", language: "Marathi", channel: "whatsapp", status: "approved", consent: "granted" },
  { id: "e2", personName: "XYZ Realty", personType: "partner", eventType: "Partner Anniversary", eventDate: "2026-09-01", language: "English", channel: "email", status: "planned", consent: "granted" },
  { id: "e3", personName: "Neha & Amit", personType: "customer", eventType: "Wedding Anniversary", eventDate: "2026-09-01", language: "Hindi", channel: "whatsapp", status: "sent", consent: "granted" },
  { id: "e4", personName: "Old Prospect", personType: "lead", eventType: "Festival: Ganesh Chaturthi", eventDate: "2026-09-01", language: "Marathi", channel: "whatsapp", status: "suppressed", suppressionReason: "consent_unknown", consent: "unknown" },
];

export default function CrmEngagementPage() {
  const [moments] = useState<EngagementMoment[]>(TODAY_MOMENTS);
  const [filter, setFilter] = useState<string>("all");

  const filtered = moments.filter((m) =>
    filter === "all" ? true : filter === "suppressed" ? m.status === "suppressed" : m.status === filter,
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Vishesh Engagement Command Centre</h1>
          <p className="text-sm text-slate-600">Relationship moments — birthdays, anniversaries, festivals — with consent, quiet-hours and frequency guards enforced server-side</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded-md font-medium transition">
            Plan Today&apos;s Engagements
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
            + Add Important Date
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today&apos;s Vishesh</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{moments.length} Moments</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Pending Approvals</div>
          <div className="text-xl font-bold text-amber-700 mt-1">{moments.filter((m) => m.status === "planned").length} Need Review</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Messages Sent</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{moments.filter((m) => m.status === "sent").length} Delivered</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-rose-600 uppercase tracking-wider">Suppressed</div>
          <div className="text-xl font-bold text-rose-700 mt-1">{moments.filter((m) => m.status === "suppressed").length} Blocked (consent/gates)</div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-3">
        {["all", "planned", "approved", "sent", "suppressed"].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition ${
              filter === st ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {st === "planned" ? "Needs approval" : st}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((m) => (
          <div key={m.id} className="bg-white rounded-lg border border-slate-200 p-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                {m.personName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-slate-900 text-sm">
                  {m.personName}
                  <span className="ml-2 text-xs font-normal capitalize text-slate-500">{m.personType}</span>
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                  {m.eventType} · {m.language} · preferred: {m.channel}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {m.consent !== "granted" && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800">
                  No consent
                </span>
              )}
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${
                  m.status === "sent"
                    ? "bg-emerald-100 text-emerald-800"
                    : m.status === "suppressed"
                    ? "bg-rose-100 text-rose-800"
                    : m.status === "approved"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {m.status === "suppressed" && m.suppressionReason ? m.suppressionReason.replace(/_/g, " ") : m.status}
              </span>
              {m.status === "planned" && (
                <button className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 py-1 rounded transition font-medium">
                  Approve &amp; Send
                </button>
              )}
              {m.status !== "sent" && m.consent === "granted" && (
                <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3 py-1 rounded transition font-medium">
                  Suppress
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-10 text-center text-sm text-slate-500">
            No relationship moments in this view today.
          </div>
        )}
      </div>
    </div>
  );
}
