"use client";

import React, { useState } from "react";

interface EmployeeItem {
  id: string;
  code: string;
  name: string;
  designation: string;
  department: string;
  monthlyCtcPaise: bigint;
  pfEnrolled: boolean;
  status: "active" | "on_leave" | "exited";
  joinedDate: string;
}

const INITIAL_EMPLOYEES: EmployeeItem[] = [
  {
    id: "emp-1",
    code: "EMP-1001",
    name: "Rajesh Kumar",
    designation: "Senior Site Engineer",
    department: "Projects & Civil",
    monthlyCtcPaise: 85_000_00n, // ₹85,000 / mo
    pfEnrolled: true,
    status: "active",
    joinedDate: "2024-03-15",
  },
  {
    id: "emp-2",
    code: "EMP-1002",
    name: "Priya Sharma",
    designation: "Finance Manager",
    department: "Finance & Accounts",
    monthlyCtcPaise: 1_20_000_00n, // ₹1,20,000 / mo
    pfEnrolled: true,
    status: "active",
    joinedDate: "2023-08-01",
  },
  {
    id: "emp-3",
    code: "EMP-1003",
    name: "Amit Patel",
    designation: "Sales Executive",
    department: "Sales & Marketing",
    monthlyCtcPaise: 45_000_00n, // ₹45,000 / mo
    pfEnrolled: true,
    status: "active",
    joinedDate: "2025-01-10",
  },
];

export default function HrEmployeesPage() {
  const [employees] = useState<EmployeeItem[]>(INITIAL_EMPLOYEES);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HRMS & Payroll Management</h1>
          <p className="text-sm text-slate-600">Employee master, attendance, statutory deductions (PF/ESIC/PT/TDS), and monthly payroll run</p>
        </div>
        <div className="flex gap-2">
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm px-4 py-2 rounded-md font-medium transition">
            Run Monthly Payroll
          </button>
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm px-4 py-2 rounded-md font-medium transition">
            + Onboard Employee
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Headcount</div>
          <div className="text-xl font-bold text-slate-900 mt-1">3 Employees Active</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Wage Bill</div>
          <div className="text-xl font-bold text-slate-900 mt-1">₹2.50 Lakh / mo</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">PF & ESIC Compliance</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">100% Enrolled</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">TDS Slabs Applied</div>
          <div className="text-xl font-bold text-slate-900 mt-1">New Tax Regime</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 text-xs">
            <tr>
              <th className="p-3">Emp Code</th>
              <th className="p-3">Employee Name</th>
              <th className="p-3">Designation</th>
              <th className="p-3">Department</th>
              <th className="p-3">Monthly CTC</th>
              <th className="p-3">Joining Date</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {employees.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-semibold text-emerald-700">{emp.code}</td>
                <td className="p-3 font-medium text-slate-900">{emp.name}</td>
                <td className="p-3 text-slate-700">{emp.designation}</td>
                <td className="p-3 text-xs text-slate-600">{emp.department}</td>
                <td className="p-3 font-mono font-medium text-slate-900">
                  ₹{(Number(emp.monthlyCtcPaise) / 100).toLocaleString("en-IN")}
                </td>
                <td className="p-3 text-slate-600 text-xs">{emp.joinedDate}</td>
                <td className="p-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 capitalize">
                    {emp.status}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs px-3 py-1 rounded transition font-medium">
                    View Payslip
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
