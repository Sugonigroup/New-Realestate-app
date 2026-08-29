import { describe, expect, it } from "vitest";
import { cleanName, normalizeEmail, normalizePhone, normalizeLead } from "./normalize.js";
import { dedupDecision, type ExistingLead } from "./dedup.js";
import { route, type RoutingRule } from "./routing.js";
import { isSlaBreached, slaAckBy, slaRespondBy } from "./sla.js";

describe("lead normalization", () => {
  it("normalizes Indian phone formats to +91XXXXXXXXXX", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
    expect(normalizePhone("9876543210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
  });

  it("rejects non-mobile numbers (no guessing)", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("5987654321")).toBeNull(); // 5-prefix not a mobile
    expect(normalizePhone("98765")).toBeNull();
  });

  it("cleans names and emails", () => {
    expect(cleanName("  ravi   kumar ")).toBe("Ravi Kumar");
    expect(normalizeEmail("  Ravi@Example.COM ")).toBe("ravi@example.com");
    expect(normalizeEmail("not-an-email")).toBeUndefined();
  });

  it("normalizeLead rejects invalid input with a reason", () => {
    expect(normalizeLead({ fullName: "", phone: "9876543210" })).toMatchObject({ error: "missing name" });
    expect(normalizeLead({ fullName: "X Y", phone: "1" })).toMatchObject({ error: /invalid phone/ });
    expect(normalizeLead({ fullName: "Ravi Kumar", phone: "+91 98765 43210" })).toMatchObject({
      phone: "+919876543210",
      fullName: "Ravi Kumar",
    });
  });
});

describe("dedup engine (BR-2A)", () => {
  const existing: ExistingLead[] = [
    { id: "l1", phone: "+919876543210", email: "ravi@example.com", projectId: "proj-a", status: "qualified" },
  ];

  it("same phone + same project → duplicate (no new lead)", () => {
    expect(
      dedupDecision(existing, { phone: "+919876543210", projectId: "proj-a" }),
    ).toMatchObject({ kind: "duplicate", matchLeadId: "l1" });
  });

  it("same phone + different project → linked new opportunity", () => {
    expect(
      dedupDecision(existing, { phone: "+919876543210", projectId: "proj-b" }),
    ).toMatchObject({ kind: "linked", matchLeadId: "l1" });
  });

  it("same email without phone match → duplicate", () => {
    expect(dedupDecision(existing, { phone: "+919812345678", email: "ravi@example.com" })).toMatchObject({
      kind: "duplicate",
      matchLeadId: "l1",
      reason: "same email",
    });
  });

  it("unknown contact → new", () => {
    expect(dedupDecision(existing, { phone: "+919812345678", email: "new@x.com" })).toMatchObject({ kind: "new" });
  });
});

describe("routing engine", () => {
  const rules: RoutingRule[] = [
    { segment: "commercial", assignToRole: "sales_manager" },
    { language: "hi", assignToUsers: ["hi-1", "hi-2"] },
    { assignToUsers: ["exec-1", "exec-2", "exec-3"] },
  ];
  const loads = new Map([["exec-1", 5], ["exec-2", 3], ["exec-3", 3]]);

  it("first matching rule wins (commercial → role queue)", () => {
    expect(route({ segment: "commercial" }, rules, loads, new Map())).toMatchObject({
      ruleIndex: 0,
      assignedRole: "sales_manager",
    });
  });

  it("least-loaded user wins; ties break round-robin", () => {
    const r1 = route({}, rules, loads, new Map());
    expect(r1?.assignedUserId).toMatch(/exec-[23]/);
    const lastAssigned = new Map([
      ["exec-1", 0], ["exec-2", 5], ["exec-3", 1],
    ]);
    const equal = new Map([["exec-1", 4], ["exec-2", 4], ["exec-3", 4]]);
    expect(route({}, rules, equal, lastAssigned)?.assignedUserId).toBe("exec-1"); // least recently assigned
  });

  it("no matching rule → null (caller escalates)", () => {
    expect(route({}, [], loads, new Map())).toBeNull();
  });
});

describe("SLA clocks", () => {
  it("15-min WhatsApp ack, 2-h human response, breach detection", () => {
    const t0 = new Date("2025-06-01T06:00:00Z");
    expect(slaAckBy(t0).getTime() - t0.getTime()).toBe(15 * 60_000);
    expect(slaRespondBy(t0).getTime() - t0.getTime()).toBe(2 * 60 * 60_000);
    const lead = { slaRespondBy: slaRespondBy(t0), firstRespondedAt: null };
    expect(isSlaBreached(lead, new Date(t0.getTime() + 2 * 60 * 60_000 + 1))).toBe(true);
    expect(isSlaBreached({ ...lead, firstRespondedAt: new Date(t0.getTime() + 60_000) }, new Date())).toBe(false);
  });
});
