"use client";

import Link from "next/link";

/** In-module chip nav so live screens are reachable without extra sidebar keys. */
export function Subnav({ items }: { items: Array<{ href: string; label: string }> }) {
  return (
    <nav className="mb-4 flex flex-wrap gap-2 text-sm">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className="rounded px-3 py-1"
          style={{ background: "var(--bo-bg)", color: "var(--bo-text)" }}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  );
}

export const FINANCE_NAV = [
  { href: "/finance/demands", label: "Demands" },
  { href: "/finance/collections", label: "Collections" },
  { href: "/finance/escrow", label: "Escrow" },
  { href: "/finance/ledger", label: "Ledger" },
  { href: "/finance/trial-balance", label: "Trial balance" },
  { href: "/finance/ap", label: "AP run" },
];

export const CRM_NAV = [
  { href: "/crm", label: "Inbox" },
  { href: "/crm/queue", label: "Queue" },
  { href: "/crm/diary", label: "Diary" },
  { href: "/crm/opportunities/kanban", label: "Kanban" },
  { href: "/crm/engagement", label: "Engagement" },
  { href: "/crm/tasks", label: "Tasks" },
  { href: "/crm/analytics", label: "Analytics" },
  { href: "/crm/recommendations", label: "Recs" },
  { href: "/crm/organizations", label: "Orgs" },
  { href: "/crm/data-quality", label: "Quality" },
  { href: "/crm/forecast", label: "Forecast" },
  { href: "/crm/assignment-rules", label: "Rules" },
  { href: "/crm/drafts", label: "Drafts" },
  { href: "/crm/views", label: "Views" },
  { href: "/crm/export", label: "Export" },
  { href: "/crm/partners", label: "Partners" },
  { href: "/crm/fields", label: "Fields" },
  { href: "/crm/threads", label: "Threads" },
  { href: "/partners", label: "Portal" },
];

export const HR_NAV = [
  { href: "/hr/employees", label: "Employees" },
  { href: "/hr/recruitment", label: "Recruitment" },
  { href: "/hr/payroll", label: "Payroll" },
  { href: "/hr/muster", label: "Muster" },
  { href: "/hr/attendance", label: "Attendance" },
];

export const COMPLIANCE_NAV = [
  { href: "/compliance/rera", label: "RERA QPR" },
  { href: "/compliance/calendar", label: "Statutory" },
  { href: "/compliance/bundle", label: "QPR bundle" },
];

export const ADMIN_NAV = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/roles", label: "Roles" },
  { href: "/admin/audit", label: "Audit" },
  { href: "/admin/metrics", label: "Metrics" },
  { href: "/notifications", label: "Notifications" },
];

export const PROCUREMENT_NAV = [
  { href: "/procurement/prs", label: "PRs" },
  { href: "/procurement/vendors", label: "Vendors" },
  { href: "/procurement/ra-bills", label: "RA bills" },
  { href: "/procurement/rfqs", label: "RFQs" },
  { href: "/procurement/grns", label: "GRNs" },
];

export const OPS_NAV = [
  { href: "/ops-support/risks", label: "Risks" },
  { href: "/ops-support/tickets", label: "Tickets" },
  { href: "/ops-support/heatmap", label: "Heatmap" },
  { href: "/ops-support/findings", label: "Findings" },
];

export const PROJECT_NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/contracts", label: "Contracts" },
  { href: "/assets", label: "Assets" },
  { href: "/siteops", label: "Site ops" },
  { href: "/land", label: "Land" },
  { href: "/siteops/hse", label: "HSE" },
  { href: "/siteops/quality", label: "Quality" },
  { href: "/documents", label: "Documents" },
];

export const MARKETING_NAV = [
  { href: "/marketing/campaigns", label: "Campaigns" },
  { href: "/marketing/roi", label: "ROI" },
];

export const SALES_NAV = [
  { href: "/sales/inventory", label: "Inventory" },
  { href: "/sales/bookings", label: "Bookings" },
  { href: "/sales/quote", label: "Quote" },
  { href: "/portal", label: "Buyer" },
];

export const PORTAL_NAV = [
  { href: "/portal/home", label: "Home" },
  { href: "/portal/payments", label: "Payments" },
  { href: "/portal/consents", label: "Consents" },
];
