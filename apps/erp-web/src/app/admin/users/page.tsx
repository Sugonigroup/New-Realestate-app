"use client";

import React, { useState } from "react";

interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  roleCode: string;
  dataScope: "ALL" | "ENTITY" | "PROJECT" | "OWN";
  assignedProjects: string[];
  status: "active" | "suspended";
}

const INITIAL_USERS: UserAccount[] = [
  {
    id: "usr-1",
    email: "cfo@buildos.internal",
    fullName: "Prakash Iyer",
    roleCode: "cfo",
    dataScope: "ALL",
    assignedProjects: ["All Projects"],
    status: "active",
  },
  {
    id: "usr-2",
    email: "pm.sharma@buildos.internal",
    fullName: "Rohan Sharma",
    roleCode: "project_manager",
    dataScope: "PROJECT",
    assignedProjects: ["Tower A", "Plaza B"],
    status: "active",
  },
  {
    id: "usr-3",
    email: "store.patel@buildos.internal",
    fullName: "Suresh Patel",
    roleCode: "store_manager",
    dataScope: "PROJECT",
    assignedProjects: ["Tower A"],
    status: "active",
  },
];

export default function AdminUsersPage() {
  const [users] = useState<UserAccount[]>(INITIAL_USERS);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Administration & RBAC Engine</h1>
          <p className="text-sm text-slate-600">User provisioning, role template assignments, and data scope (ALL/ENTITY/PROJECT/OWN) controls</p>
        </div>
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
          + Provision User
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Provisioned Users</div>
          <div className="text-xl font-bold text-slate-900 mt-1">3 Active Accounts</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Seeded Role Templates</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">20 System Roles</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Multitenant Isolation</div>
          <div className="text-xl font-bold text-slate-900 mt-1">PostgreSQL RLS Active</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">User Email</th>
              <th className="p-3">Full Name</th>
              <th className="p-3">Role Code</th>
              <th className="p-3">Data Scope</th>
              <th className="p-3">Assigned Projects</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((usr) => (
              <tr key={usr.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{usr.email}</td>
                <td className="p-3 font-medium text-slate-900">{usr.fullName}</td>
                <td className="p-3 font-mono text-xs text-slate-800 uppercase">{usr.roleCode}</td>
                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-100 text-slate-800">
                    {usr.dataScope}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-600">{usr.assignedProjects.join(", ")}</td>
                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                    {usr.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3 py-1 rounded transition font-medium">
                    Edit Permissions
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
