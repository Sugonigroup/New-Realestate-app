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
  { key: "crm", label: "CRM", module: "crm", href: "/crm" },
  { key: "sales", label: "Inventory", module: "sales", href: "/sales/inventory" },
  { key: "sales_bookings", label: "Bookings", module: "sales", href: "/sales/bookings" },
  { key: "marketing", label: "Marketing", module: "marketing", href: "/marketing/campaigns" },
  { key: "projects", label: "Projects", module: "projects", href: "/projects" },
  { key: "contracts", label: "Contracts", module: "projects", href: "/contracts" },
  { key: "assets", label: "Assets", module: "projects", href: "/assets" },
  { key: "procurement", label: "Procurement", module: "procurement", href: "/procurement/prs" },
  { key: "finance", label: "Finance", module: "finance", href: "/finance" },
  { key: "siteops", label: "Site Ops", module: "projects", href: "/siteops" },
  { key: "compliance", label: "Compliance", module: "compliance", href: "/compliance/rera" },
  { key: "hr", label: "HR", module: "hr", href: "/hr/employees" },
  { key: "documents", label: "Documents", module: "docs", href: "/documents" },
  { key: "reports", label: "Budgeting", module: "reports", href: "/budgeting" },
  { key: "ops", label: "Ops Support", module: "reports", href: "/ops-support/risks" },
  { key: "treasury", label: "Treasury", module: "reports", href: "/treasury" },
  { key: "ai", label: "AI Command Center", module: "ai", href: "/ai" },
  { key: "settings", label: "Settings", module: "settings", href: "/admin/users" },
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
