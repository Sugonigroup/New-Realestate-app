import { ROLE_MAP } from "@buildos/permissions";

/** ERP information architecture (04 §3) — sidebar modules with their owning module segment. */
export interface NavItem {
  key: string;
  label: string;
  href?: string;
  /** first segment of the module's permission space; null = always visible */
  module: string | null;
}

export const ERP_NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", module: null, href: "/" },
  { key: "approvals", label: "Approvals", module: "workflow", href: "/approvals" },
  { key: "crm", label: "CRM Inbox", module: "crm", href: "/crm" },
  { key: "crm_kanban", label: "Pipeline Kanban", module: "crm", href: "/crm/opportunities/kanban" },
  { key: "crm_queue", label: "Work Queue", module: "crm", href: "/crm/queue" },
  { key: "crm_diary", label: "Sales Diary", module: "crm", href: "/crm/diary" },
  { key: "crm_engagement", label: "Engagement (Vishesh)", module: "crm", href: "/crm/engagement" },
  { key: "sales", label: "Inventory", module: "sales", href: "/sales/inventory" },
  { key: "sales_bookings", label: "Bookings", module: "sales", href: "/sales/bookings" },
  { key: "marketing", label: "Marketing", module: "marketing", href: "/marketing/campaigns" },
  { key: "projects", label: "Projects", module: "projects", href: "/projects" },
  { key: "procurement", label: "Procurement", module: "procurement", href: "/procurement/prs" },
  { key: "finance", label: "Finance", module: "finance", href: "/finance/demands" },
  { key: "budgeting", label: "Budget vs Actual", module: "finance", href: "/budgeting" },
  { key: "contracts", label: "Contracts", module: "projects", href: "/contracts" },
  { key: "assets", label: "Assets & CMMS", module: "projects", href: "/assets" },
  { key: "siteops", label: "Site Ops (EPC)", module: "projects", href: "/siteops" },
  { key: "risks", label: "Risk & CSAT", module: "reports", href: "/ops-support/risks" },
  { key: "compliance", label: "Compliance", module: "compliance", href: "/compliance/rera" },
  { key: "hr", label: "HR Employees", module: "hr", href: "/hr/employees" },
  { key: "hr_recruitment", label: "Recruitment", module: "hr", href: "/hr/recruitment" },
  { key: "documents", label: "Documents", module: "docs", href: "/admin/audit" },
  { key: "reports", label: "Reports", module: "reports", href: "/finance/collections" },
  { key: "admin_users", label: "Users & Roles", module: "settings", href: "/admin/users" },
  { key: "ai", label: "AI Command Center", module: "ai", href: "/ai" },
];

/**
 * Role-filtered sidebar: a module is visible when the user holds ANY grant in that
 * module's permission space (module-level access is the nav contract; record-level
 * visibility stays with the API's DataScopes).
 */
export function filterNav(roles: string[], rolePermissions: Map<string, string[]>): NavItem[] {
  const grants = roles.flatMap((r) => rolePermissions.get(r) ?? []);
  return ERP_NAV.filter(
    (item) =>
      item.module === null ||
      grants.some((g) => g === "**" || g.startsWith("**.") || g.split(".")[0] === item.module),
  );
}

/** Convenience: the seeded role template map. */
export function seededRolePermissions(): Map<string, string[]> {
  return new Map([...ROLE_MAP].map(([code, r]) => [code, r.permissions]));
}
