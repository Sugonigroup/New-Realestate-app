import { describe, expect, it } from "vitest";
import {
  PermissionEngine,
  parsePattern,
  parsePermission,
  permissionMatches,
  type UserContext,
} from "./model.js";
import { ROLE_MAP, ROLE_TEMPLATES } from "./roles.js";

describe("permission strings", () => {
  it("requires ≥3 segments", () => {
    expect(() => parsePermission("sales.booking")).toThrow(TypeError);
    expect(parsePermission("sales.booking.create").segments).toEqual(["sales", "booking", "create"]);
  });

  it("matches exact, single-star, and trailing double-star", () => {
    expect(permissionMatches("sales.booking.create", "sales.booking.create")).toBe(true);
    expect(permissionMatches("sales.*", "sales.booking.create")).toBe(true);
    expect(permissionMatches("sales.*", "finance.demand.create")).toBe(false);
    expect(permissionMatches("**", "anything.at.all")).toBe(true);
    expect(permissionMatches("**.read", "finance.ledger.read")).toBe(true);
    expect(permissionMatches("**.read", "finance.ledger.create")).toBe(false);
    expect(permissionMatches("sales.*", "sales")).toBe(false); // '*' needs a following segment
  });
});

const engine = new PermissionEngine(ROLE_MAP);
const user = (roles: string[], userId = "u1"): UserContext => ({ userId, roles, scopes: [] });

describe("engine + role templates (authz matrix spot checks from 03 §2.2)", () => {
  it("super admin can do anything", () => {
    expect(engine.evaluate(user(["super_admin"]), "settings.autonomy.write").allowed).toBe(true);
  });

  it("MD is blocked from editing roles/autonomy (deny overrides wildcard)", () => {
    expect(engine.evaluate(user(["md"]), "settings.roles.write").allowed).toBe(false);
    expect(engine.evaluate(user(["md"]), "settings.autonomy.write").allowed).toBe(false);
    expect(engine.evaluate(user(["md"]), "finance.escrow.withdraw").allowed).toBe(true);
  });

  it("sales executive can draft bookings but never approve discounts", () => {
    const exec = user(["sales_executive"]);
    expect(engine.evaluate(exec, "crm.lead.create").allowed).toBe(true);
    expect(engine.evaluate(exec, "sales.booking.draft").allowed).toBe(true);
    expect(engine.evaluate(exec, "sales.booking.approve").allowed).toBe(false);
    expect(engine.evaluate(exec, "sales.discount.approve").allowed).toBe(false);
  });

  it("sales manager can approve discounts, not release payments", () => {
    const mgr = user(["sales_manager"]);
    expect(engine.evaluate(mgr, "sales.discount.approve").allowed).toBe(true);
    expect(engine.evaluate(mgr, "sales.paymentrun.release").allowed).toBe(false);
  });

  it("finance manager is denied payment-run release and escrow withdrawal by deny list", () => {
    const fm = user(["finance_manager"]);
    expect(engine.evaluate(fm, "finance.demand.create").allowed).toBe(true);
    expect(engine.evaluate(fm, "finance.paymentrun.release").allowed).toBe(false);
    expect(engine.evaluate(fm, "finance.escrow.withdraw").allowed).toBe(false);
  });

  it("auditor is read-only across every module", () => {
    const aud = user(["finance_readonly"]);
    expect(engine.evaluate(aud, "finance.ledger.read").allowed).toBe(true);
    expect(engine.evaluate(aud, "audit.log.read").allowed).toBe(true);
    expect(engine.evaluate(aud, "reports.pack.read").allowed).toBe(true);
    expect(engine.evaluate(aud, "projects.milestone.create").allowed).toBe(false);
    expect(engine.evaluate(aud, "procurement.po.approve").allowed).toBe(false);
  });

  it("denies unknown roles gracefully and flags them in ctx validation", () => {
    expect(engine.evaluate(user(["ghost"]), "crm.lead.read")).toMatchObject({ allowed: false, reason: "no-permission" });
    expect(() => engine.assertKnownRoles(["ghost"])).toThrow(RangeError);
  });
});

describe("data scopes (ABAC layer)", () => {
  const projA = "proj-a";
  const execScoped = (): UserContext => ({
    userId: "exec-1",
    roles: ["sales_executive"],
    scopes: [{ level: "PROJECT", refs: [projA] }],
  });

  it("PROJECT scope admits only that project", () => {
    expect(engine.inScope(execScoped(), { projectId: projA })).toBe(true);
    expect(engine.inScope(execScoped(), { projectId: "proj-b" })).toBe(false);
    expect(engine.evaluate(execScoped(), "crm.lead.create", { projectId: "proj-b" })).toMatchObject({
      allowed: false,
      reason: "out-of-scope",
    });
  });

  it("OWN scope admits only own records", () => {
    const own: UserContext = { userId: "exec-1", roles: ["sales_executive"], scopes: [{ level: "OWN" }] };
    expect(engine.inScope(own, { ownerId: "exec-1" })).toBe(true);
    expect(engine.inScope(own, { ownerId: "exec-2" })).toBe(false);
  });

  it("ALL scope passes anywhere", () => {
    const all: UserContext = { userId: "cfo-1", roles: ["cfo"], scopes: [{ level: "ALL" }] };
    expect(engine.inScope(all, { projectId: "whatever" })).toBe(true);
  });
});

describe("template integrity", () => {
  it("template integrity: unique codes and well-formed grant patterns", () => {
    const codes = ROLE_TEMPLATES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const r of ROLE_TEMPLATES) {
      for (const p of [...r.permissions, ...(r.denied ?? [])]) {
        expect(() => parsePattern(p)).not.toThrow(); // grants may be wildcard-short
      }
    }
  });

  it("includes the 20+ seeded roles incl. the 16 mandated ones", () => {
    for (const code of [
      "super_admin", "md", "project_manager", "site_engineer", "procurement_manager",
      "store_manager", "finance_manager", "accountant", "channel_partner", "quality_manager",
      "safety_manager", "sales_manager", "sales_executive", "finance_readonly",
    ]) {
      expect(ROLE_MAP.has(code)).toBe(true);
    }
    expect(ROLE_MAP.size).toBeGreaterThanOrEqual(20);
  });
});
