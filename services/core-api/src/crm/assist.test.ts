import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { CrmAssistService } from "./assist.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    leads: [] as Row[],
    opps: [] as Row[],
    recs: [] as Row[],
    tasks: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(row[k]);
      if (v && typeof v === "object" && "notIn" in (v as object)) return !((v as { notIn: unknown[] }).notIn).includes(row[k]);
      if (v && typeof v === "object" && ("gte" in (v as object) || "lte" in (v as object))) {
        const r = v as { gte?: unknown; lte?: unknown };
        if (r.gte !== undefined && (row[k] as number) < (r.gte as number)) return false;
        if (r.lte !== undefined && (row[k] as number) > (r.lte as number)) return false;
        return true;
      }
      return row[k] === v;
    });
  }

  const prisma = {
    lead: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const row = db.leads.find(match(where));
        if (!row) return null;
        const res = { ...row };
        if (include?.interactions) res.interactions = (row.interactions as Row[]) ?? [];
        return res;
      }),
      findMany: vi.fn(async ({ where, include }: any) =>
        db.leads.filter(match(where)).map((l) => {
          const res = { ...l };
          if (include?.interactions) res.interactions = (l.interactions as Row[]) ?? [];
          return res;
        }),
      ),
    },
    opportunity: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.opps.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.opps.filter(match(where)).map((o) => ({ ...o }))),
    },
    crmRecommendation: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.recs.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let res = db.recs.filter(match(where)).map((r) => ({ ...r }));
        if (orderBy?.[0]?.createdAt === "desc") res.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
        return res;
      }),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("rec"), createdAt: new Date(), ...data }; db.recs.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.recs.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    crmTask: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.tasks.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.tasks.filter(match(where)).map((t) => ({ ...t }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("t"), createdAt: new Date(), ...data }; db.tasks.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.tasks.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";
const NOW = new Date("2026-09-01T10:00:00Z");

describe("CrmAssistService (CRM-6)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: CrmAssistService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new CrmAssistService(f.prisma as never);
  });

  it("generates SLA-at-risk recommendation for unresponded lead due within 2h", async () => {
    f.db.leads.push({
      id: "l1", tenantId: T, status: "new", score: 40, source: "meta_ads",
      slaRespondBy: new Date(NOW.getTime() + 3600_000), assignedUserId: "rep-1",
      interactions: [], createdAt: NOW,
    });

    const res = await svc.generateRecommendations(T, NOW);
    expect(res.generated).toBe(1);
    expect(res.recommendations[0]!.recType).toBe("sla_at_risk");

    // Re-run does not duplicate pending recs
    const again = await svc.generateRecommendations(T, NOW);
    expect(again.generated).toBe(0);
  });

  it("generates hot_lead_visit for high-score lead never visited, and stalled_opportunity", async () => {
    f.db.leads.push({
      id: "l2", tenantId: T, status: "qualified", score: 85, source: "portal",
      slaRespondBy: new Date(NOW.getTime() - 3600_000 * 5), assignedUserId: "rep-2",
      interactions: [], createdAt: NOW,
    });
    f.db.opps.push({
      id: "o1", tenantId: T, stage: "offer", stalledSince: new Date(NOW.getTime() - 12 * 86400_000),
      probabilityPct: 70, assignedUserId: "rep-2",
    });

    const res = await svc.generateRecommendations(T, NOW);
    const types = res.recommendations.map((r) => r.recType).sort();
    expect(types).toContain("hot_lead_visit");
    expect(types).toContain("stalled_opportunity");
  });

  it("accepting a recommendation creates a task (human approval, CRM-121)", async () => {
    f.db.recs.push({
      id: "r1", tenantId: T, recType: "inactive_lead", targetType: "lead", targetId: "l1",
      reason: "No interaction for 20 days", evidence: {}, confidence: 75, impact: "medium",
      ownerUserId: "rep-1", dueOn: new Date(NOW.getTime() + 3 * 86400_000), status: "pending",
    });

    const decided = await svc.decideRecommendation(T, "r1", true, "crm-head");
    expect(decided.status).toBe("accepted");

    const task = f.db.tasks[0]!;
    expect(task.createdFrom).toBe("ai_recommendation");
    expect(task.assigneeId).toBe("rep-1");
    expect(task.recommendationId).toBe("r1");

    // Cannot decide twice
    await expect(svc.decideRecommendation(T, "r1", false, "x")).rejects.toThrow(ConflictException);
  });

  it("manual task lifecycle: create → complete, and copilot brief summarizes a lead deterministically", async () => {
    const task = await svc.createTask(T, {
      leadId: "l1", title: "Send revised quote", dueOn: new Date(NOW.getTime() + 86400_000), assigneeId: "rep-1",
    });
    const done = await svc.completeTask(T, task.id);
    expect(done.status).toBe("done");
    await expect(svc.completeTask(T, task.id)).rejects.toThrow(ConflictException);

    f.db.leads.push({
      id: "l1", tenantId: T, fullName: "Rajesh Patil", status: "contacted", score: 65, source: "meta_ads",
      slaRespondBy: null, firstRespondedAt: new Date("2026-08-20T10:00:00Z"), assignedUserId: "rep-1",
      interactions: [
        { id: "i1", type: "call", createdAt: new Date("2026-07-20T10:00:00Z") },
        { id: "i2", type: "whatsapp", createdAt: new Date("2026-07-21T11:00:00Z") },
      ],
      createdAt: NOW,
    });

    const brief = await svc.copilotBrief(T, "l1");
    expect(brief.summary).toContain("Rajesh Patil");
    expect(brief.summary).toContain("contacted");
    expect(brief.interactionBreakdown["call"]).toBe(1);
    expect(brief.interactionBreakdown["whatsapp"]).toBe(1);
    expect(brief.nextBestAction).toContain("Reactivation");
    expect(brief.openTasks).toBe(0);

    await expect(svc.copilotBrief(T, "nope")).rejects.toThrow(NotFoundException);
  });
});
