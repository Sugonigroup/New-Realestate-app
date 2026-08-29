import { ROLE_MAP } from "@buildos/permissions";

/** ERP information architecture (04 §3) — sidebar modules with their owning module segment. */
export interface NavItem {
  key: string;
  label: string;
  /** first segment of the module's permission space; null = always visible */
  module: string | null;
}

export const ERP_NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", module: null },
  { key: "crm", label: "CRM", module: "crm" },
  { key: "sales", label: "Sales", module: "sales" },
  { key: "marketing", label: "Marketing", module: "marketing" },
  { key: "projects", label: "Projects", module: "projects" },
  { key: "procurement", label: "Procurement", module: "procurement" },
  { key: "finance", label: "Finance", module: "finance" },
  { key: "compliance", label: "Compliance", module: "compliance" },
  { key: "hr", label: "HR", module: "hr" },
  { key: "documents", label: "Documents", module: "docs" },
  { key: "reports", label: "Reports", module: "reports" },
  { key: "ai", label: "AI Command Center", module: "ai" },
  { key: "settings", label: "Settings", module: "settings" },
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
