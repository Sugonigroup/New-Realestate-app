import { describe, expect, it } from "vitest";
import { ERP_NAV, filterNav, seededRolePermissions } from "./nav.js";

const MAP = seededRolePermissions();

describe("role-filtered navigation (04 §3)", () => {
  it("super_admin sees everything", () => {
    expect(filterNav(["super_admin"], MAP)).toHaveLength(ERP_NAV.length);
  });

  it("sales executive sees Dashboard + CRM/Sales, not Finance/HR/Settings", () => {
    const keys = filterNav(["sales_executive"], MAP).map((n) => n.key);
    expect(keys).toEqual(["dashboard", "crm", "sales", "sales_bookings"]);
  });

  it("auditor (read-only everywhere) sees all modules read-only", () => {
    const keys = filterNav(["finance_readonly"], MAP).map((n) => n.key);
    expect(keys).toHaveLength(ERP_NAV.length); // "**.read" grants module-wide read visibility
  });

  it("cfo sees finance, sales and reports, not site ops", () => {
    const keys = filterNav(["cfo"], MAP).map((n) => n.key);
    expect(keys).toContain("finance");
    expect(keys).toContain("reports");
    expect(keys).not.toContain("projects");
  });

  it("Finance nav points at the GL workspace", () => {
    expect(ERP_NAV.find((n) => n.key === "finance")?.href).toBe("/finance");
  });

  it("Procurement nav points at the sourcing workspace", () => {
    expect(ERP_NAV.find((n) => n.key === "procurement")?.href).toBe("/procurement");
  });
});
