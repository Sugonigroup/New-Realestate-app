/**
 * Seeded role templates — `03-backend-architecture.md §2.2` (20 roles).
 * Permission strings follow `context.resource.action`; wildcards for module-level grants.
 * These are templates: tenants may clone/edit; permissions remain the truth.
 */
import type { Role } from "./model.js";

const R = (
  code: string,
  name: string,
  permissions: string[],
  opts?: { denied?: string[]; external?: boolean },
): Role => ({ code, name, permissions, denied: opts?.denied, external: opts?.external });

export const ROLE_TEMPLATES: Role[] = [
  R("super_admin", "Super Admin", ["**"]),
  R("md", "MD / Promoter", ["**"], { denied: ["settings.roles.write", "settings.autonomy.write"] }),
  R("cfo", "CFO / Finance Head", [
    "finance.*", "reports.*", "compliance.read", "sales.discount.approve",
    "procurement.po.approve", "workflow.approve", "reports.read", "audit.read",
  ]),
  R("finance_manager", "Finance Manager", [
    "finance.demand.*", "finance.receipt.*", "finance.recon.*", "finance.ap.create",
    "finance.journal.create", "finance.journal.post",
    "finance.refund.propose", "reports.read", "workflow.act",
  ], { denied: ["finance.paymentrun.release", "finance.escrow.withdraw"] }),
  R("accountant", "Accountant", [
    "finance.read", "finance.demand.read", "finance.ap.create", "finance.voucher.read",
    "finance.journal.create", "finance.journal.post",
  ]),
  R("project_director", "Project Director", [
    "projects.*", "procurement.read", "reports.read", "workflow.approve", "quality.approve", "safety.read",
  ]),
  R("project_manager", "Project Manager", [
    "projects.*", "procurement.requisition.create", "procurement.rfq.create", "contractors.read",
    "quality.*", "safety.read", "workflow.act", "reports.read",
  ], { denied: ["projects.baseline.approve"] }),
  R("site_engineer", "Site Engineer", [
    "siteops.*", "projects.progress.create", "projects.milestone.request", "inventory.issue",
    "quality.inspection.create", "safety.observation.create", "snags.*",
  ]),
  R("civil_engineer", "Civil Engineer", [
    "projects.read", "projects.wbs.edit", "boq.read", "boq.propose", "siteops.*", "quality.inspection.create",
  ]),
  R("procurement_manager", "Procurement Manager", [
    "procurement.*", "inventory.read", "contractors.read", "contractors.rate.view", "reports.read", "workflow.act",
  ], { denied: ["procurement.vendor.blacklist"] }),
  R("store_manager", "Store Manager", ["inventory.*", "procurement.grn.create", "procurement.read", "inventory.writeoff.propose"]),
  R("finance_readonly", "Auditor", ["**.read", "audit.read", "reports.read"], { denied: ["**.create", "**.update", "**.delete", "**.approve", "**.release"] }),
  R("sales_head", "Sales Head", [
    "sales.*", "crm.read", "marketing.read", "reports.read", "workflow.approve", "sales.discount.approve", "crm.lead.export",
  ], { denied: ["sales.paymentrun.*"] }),
  R("sales_manager", "Sales Manager", [
    "sales.read", "sales.inventory.read", "sales.hold.create", "sales.booking.create", "sales.discount.propose",
    "sales.discount.approve", "crm.team.read", "workflow.act",
  ]),
  R("sales_executive", "Sales Executive", [
    "crm.lead.*", "sales.inventory.read", "sales.hold.create", "sales.booking.draft", "sales.visit.*",
  ]),
  R("crm_executive", "CRM Executive", [
    "crm.*", "finance.demand.read", "finance.receipt.read", "complaints.*", "handover.*", "workflow.act",
  ]),
  R("marketing_manager", "Marketing Manager", ["marketing.*", "crm.lead.read", "reports.read", "sales.read"]),
  R("compliance_officer", "Compliance / Legal", [
    "compliance.*", "rera.*", "litigation.*", "docs.*", "workflow.act", "reports.read",
  ], { denied: ["compliance.qpr.submit"] }),
  R("compliance_head", "Compliance Head", ["compliance.*", "rera.*", "litigation.*", "docs.*", "workflow.approve"]),
  R("hr_manager", "HR Head / Executive", ["hr.*", "payroll.*", "workflow.approve"]),
  R("quality_manager", "Quality Manager", ["quality.*", "projects.read", "contractors.read", "workflow.approve"]),
  R("safety_manager", "Safety Manager", ["safety.*", "projects.read", "workflow.act"]),
  R("customer", "Customer (portal)", [
    "portal.customer.*",
  ], { external: true }),
  R("channel_partner", "Channel Partner (portal)", ["portal.partner.*"], { external: true }),
  R("vendor", "Vendor / Contractor (portal)", ["portal.vendor.*"], { external: true }),
];

export const ROLE_MAP: Map<string, Role> = new Map(ROLE_TEMPLATES.map((r) => [r.code, r]));

/** DataScope presets used when seeding UserRole rows (`03 §2.1`). */
export const SCOPES = {
  all: { level: "ALL" },
  entity: (entityId: string) => ({ level: "ENTITY", refs: [entityId] }),
  project: (projectId: string) => ({ level: "PROJECT", refs: [projectId] }),
  own: { level: "OWN" },
} as const;
