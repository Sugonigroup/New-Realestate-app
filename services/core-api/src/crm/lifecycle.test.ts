import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CrmLifecycleService } from "./lifecycle.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    leads: [] as Row[],
    interactions: [] as Row[],
    opps: [] as Row[],
    visits: [] as Row[],
    tasks: [] as Row[],
    comms: [] as Row[],
    persons: [] as Row[],
    customValues: [] as Row[],
    outbox: [] as Row[],
    audit: [] as Row[],
    rules: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(row[k]);
      if (v && typeof v === "object" && "notIn" in (v as object)) return !((v as { notIn: unknown[] }).notIn).includes(row[k]);
      if (v && typeof v === "object" && ("lt" in (v as object) || "lte" in (v as object))) {
        const r = v as { lt?: unknown; lte?: unknown };
        if (r.lt !== undefined && !((row[k] as Date) < (r.lt as Date))) return false;
        if (r.lte !== undefined && !((row[k] as Date) <= (r.lte as Date))) return false;
        return true;
      }
      return row[k] === v;
    });
  }

  const prisma = {
    lead: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.leads.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.leads.filter(match(where)).map((l) => ({ ...l }))),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.leads.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    interaction: { updateMany: vi.fn(async ({ where, data }: any) => ({ count: db.interactions.filter(match(where)).length })) },
    opportunity: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.opps.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.opps.filter(match(where)).map((o) => ({ ...o }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("o"), createdAt: new Date(), ...data }; db.opps.push(r); return r; }),
      updateMany: vi.fn(async ({ where, data }: any) => ({ count: db.opps.filter(match(where)).length })),
    },
    siteVisit: { updateMany: vi.fn(async ({ where }: any) => ({ count: db.visits.filter(match(where)).length })) },
    crmTask: { updateMany: vi.fn(async ({ where }: any) => ({ count: db.tasks.filter(match(where)).length })) },
    communication: { updateMany: vi.fn(async ({ where }: any) => ({ count: db.comms.filter(match(where)).length })) },
    relationshipPerson: { updateMany: vi.fn(async ({ where }: any) => ({ count: db.persons.filter(match(where)).length })) },
    crmCustomFieldValue: { updateMany: vi.fn(async ({ where }: any) => ({ count: db.customValues.filter(match(where)).length })) },
    outboxEvent: { create: vi.fn(async ({ data }: any) => { const r = { id: nid("ob"), ...data }; db.outbox.push(r); return r; }) },
    auditEvent: { create: vi.fn(async ({ data }: any) => { const r = { id: nid("au"), ...data }; db.audit.push(r); return r; }) },
    crmAssignmentRule: {
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let res = db.rules.filter(match(where)).map((r) => ({ ...r }));
        if (orderBy?.priority === "asc") res.sort((a, b) => (a.priority as number) - (b.priority as number));
        return res;
      }),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("r"), createdAt: new Date(), ...data }; db.rules.push(r); return r; }),
    },
  };

  return { prisma, db };
}

const T = "t-1";
const NOW = new Date("2026-09-01T10:00:00Z");
const ACTOR = "admin-1";

describe("CrmLifecycleService (merge, convert, SLA sweep, rules)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: CrmLifecycleService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new CrmLifecycleService(f.prisma as never);
  });

  it("merges duplicate into survivor: re-parents timeline, applies precedence, retires duplicate (scenario E)", async () => {
    f.db.leads.push(
      { id: "s1", tenantId: T, fullName: "Rajesh P", email: null, budgetPaise: null, status: "qualified", createdAt: new Date("2026-08-10") },
      { id: "d1", tenantId: T, fullName: "Rajesh Patil", email: "r@x.com", budgetPaise: 9_00_000_00n, status: "contacted", createdAt: new Date("2026-08-12") },
    );
    f.db.interactions.push({ id: "i1", tenantId: T, leadId: "d1" });
    f.db.opps.push({ id: "o1", tenantId: T, leadId: "d1" });
    f.db.visits.push({ id: "v1", tenantId: T, leadId: "d1" });

    const res = await svc.mergeLeads(T, "s1", "d1", ACTOR);
    // Survivor inherited duplicate's email + budget (null-filled), earliest createdAt kept
    expect(res.survivor.email).toBe("r@x.com");
    expect(res.survivor.budgetPaise).toBe(9_00_000_00n);
    expect(res.survivor.createdAt).toEqual(new Date("2026-08-10"));
    expect(res.reParented.interactions.count).toBe(1);
    expect(res.reParented.opportunities.count).toBe(1);
    expect(res.reParented.visits.count).toBe(1);
    // duplicate retired but preserved
    expect(f.db.leads.find((l) => l.id === "d1")!.status).toBe("lost");
    // outbox + audit trail
    expect(f.db.outbox[0]!.type).toBe("lead.merged.v1");
    expect(f.db.audit[0]!.action).toBe("crm.lead.merged");

    await expect(svc.mergeLeads(T, "s1", "s1", ACTOR)).rejects.toThrow(BadRequestException);
  });

  it("converts a qualified lead into an opportunity; rejects unqualified and duplicates (CRM-018)", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, fullName: "A", status: "qualified", budgetPaise: 8_00_000_00n, projectId: "p1", assignedUserId: "rep" },
      { id: "l2", tenantId: T, fullName: "B", status: "new", projectId: "p1" },
    );
    const opp = await svc.convertLead(T, "l1", "OPP-C1", ACTOR);
    expect(opp.stage).toBe("qualification");
    expect(opp.expectedValuePaise).toBe(8_00_000_00n);
    expect(f.db.leads.find((l) => l.id === "l1")!.status).toBe("negotiation");
    expect(f.db.outbox[0]!.type).toBe("lead.converted.v1");

    await expect(svc.convertLead(T, "l2", "OPP-C2", ACTOR)).rejects.toThrow(ConflictException);
    await expect(svc.convertLead(T, "l1", "OPP-C1", ACTOR)).rejects.toThrow(ConflictException);
  });

  it("SLA sweep stamps breaches once, emits events, and is idempotent (scenario F)", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, status: "new", slaRespondBy: new Date(NOW.getTime() - 3600_000), firstRespondedAt: null, slaBreachedAt: null },
      { id: "l2", tenantId: T, status: "contacted", slaRespondBy: new Date(NOW.getTime() - 7200_000), firstRespondedAt: new Date(), slaBreachedAt: null },
      { id: "l3", tenantId: T, status: "new", slaRespondBy: new Date(NOW.getTime() + 3600_000), firstRespondedAt: null, slaBreachedAt: null },
    );
    const res1 = await svc.sweepSlaBreaches(T, NOW);
    expect(res1.breached).toBe(1); // only l1 (l2 responded, l3 not due)
    expect(f.db.leads.find((l) => l.id === "l1")!.slaBreachedAt).toEqual(NOW);
    expect(f.db.outbox[0]!.type).toBe("lead.sla_breached.v1");

    const res2 = await svc.sweepSlaBreaches(T, NOW);
    expect(res2.breached).toBe(0); // idempotent
  });

  it("evaluates assignment rules first-match-wins by priority (CRM-071/008)", async () => {
    f.db.rules.push(
      { id: "r2", tenantId: T, name: "meta-generic", priority: 200, criteria: { source: "meta_ads" }, assignToUsers: ["u3"], slaMinutes: 240, active: true },
      { id: "r1", tenantId: T, name: "meta-pune", priority: 100, criteria: { source: "meta_ads", segment: "residential" }, assignToUsers: ["u1", "u2"], slaMinutes: 15, active: true },
    );
    await svc.createAssignmentRule(T, {
      name: "x", criteria: { source: "portal" }, assignToUsers: ["u9"], slaMinutes: 60,
    });
    await expect(svc.createAssignmentRule(T, { name: "y", criteria: {}, assignToUsers: [] })).rejects.toThrow(BadRequestException);

    const m = await svc.evaluateAssignmentRules(T, { source: "meta_ads", segment: "residential", language: "en" });
    expect(m!.ruleId).toBe("r1"); // priority 100 wins
    expect(m!.slaMinutes).toBe(15);
    const other = await svc.evaluateAssignmentRules(T, { source: "meta_ads", segment: "commercial", language: "en" });
    expect(other!.ruleId).toBe("r2");
    const none = await svc.evaluateAssignmentRules(T, { source: "portal", segment: "commercial", language: "en" });
    expect(none!.ruleId).toBe(f.db.rules.find((r) => r.name === "x")!.id);
  });

  it("updates leads with audit trail; missing lead 404s", async () => {
    f.db.leads.push({ id: "l1", tenantId: T, fullName: "Old", email: "old@x.com", status: "contacted" });
    const updated = await svc.updateLead(T, "l1", { fullName: "New", email: "new@x.com" }, ACTOR);
    expect(updated.fullName).toBe("New");
    expect(f.db.audit[0]!.action).toBe("crm.lead.updated");
    expect(f.db.audit[0]!.before).toEqual({ fullName: "Old", email: "old@x.com" });
    await expect(svc.updateLead(T, "nope", { fullName: "X" }, ACTOR)).rejects.toThrow(NotFoundException);
  });
});
