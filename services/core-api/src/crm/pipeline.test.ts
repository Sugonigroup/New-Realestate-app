import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CrmPipelineService } from "./pipeline.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    leads: [] as Row[],
    opps: [] as Row[],
    unitInterests: [] as Row[],
    units: [] as Row[],
    assignmentLogs: [] as Row[],
    visits: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(row[k]);
      return row[k] === v;
    });
  }

  const prisma = {
    lead: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.leads.find(match(where));
        return row ? { ...row } : null; // detached copy, like real Prisma
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.leads.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    opportunity: {
      findFirst: vi.fn(async ({ where }: any) => db.opps.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.opps.filter(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("opp"), ...data }; db.opps.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.opps.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    opportunityUnitInterest: {
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("ui"), ...data }; db.unitInterests.push(r); return r; }),
    },
    unit: {
      findFirst: vi.fn(async ({ where }: any) => db.units.find(match(where))),
    },
    leadAssignmentLog: {
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("al"), ...data }; db.assignmentLogs.push(r); return r; }),
      findMany: vi.fn(async ({ where }: any) => db.assignmentLogs.filter(match(where))),
    },
    siteVisit: {
      findFirst: vi.fn(async ({ where }: any) => db.visits.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.visits.filter(match(where))),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.visits.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";
const PROJ = "11111111-1111-1111-1111-111111111111";

describe("CrmPipelineService", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: CrmPipelineService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new CrmPipelineService(f.prisma as never);
    f.db.leads.push({
      id: "lead-1", tenantId: T, status: "qualified", budgetPaise: 80_00_000_00n, assignedUserId: "rep-1",
    });
    f.db.units.push({
      id: "unit-1", tenantId: T, projectId: PROJ, code: "A-1201", state: "available", tower: "A", floor: 12,
    });
  });

  it("creates opportunity from a qualified lead and advances stage one step at a time", async () => {
    const opp = await svc.createOpportunity(T, {
      oppNo: "OPP-001", leadId: "lead-1", projectId: PROJ,
    });
    expect(opp.stage).toBe("prospect");
    expect(opp.probabilityPct).toBe(10);
    expect(opp.expectedValuePaise).toBe(80_00_000_00n); // inherited from lead budget

    // Skipping stages is rejected
    await expect(svc.moveStage(T, "OPP-001", "site_visit")).rejects.toThrow(BadRequestException);

    await svc.moveStage(T, "OPP-001", "qualification");
    const ui = await svc.moveStage(T, "OPP-001", "unit_interest");
    expect(ui.probabilityPct).toBe(40);
  });

  it("adds available unit as interest and auto-advances to unit_interest stage", async () => {
    await svc.createOpportunity(T, { oppNo: "OPP-002", leadId: "lead-1", projectId: PROJ });
    await svc.moveStage(T, "OPP-002", "qualification");

    const interest = await svc.addUnitInterest(T, "OPP-002", { unitId: "unit-1", configType: "3bhk" });
    expect(interest.status).toBe("active");
    expect(f.db.opps[0]!.stage).toBe("unit_interest"); // auto-advanced

    // Occupied unit rejected
    f.db.units.push({ id: "unit-2", tenantId: T, projectId: PROJ, code: "A-1202", state: "booked" });
    await expect(svc.addUnitInterest(T, "OPP-002", { unitId: "unit-2" })).rejects.toThrow(ConflictException);
  });

  it("requires hold/booking_pending stage and a booking reference for won handoff", async () => {
    await svc.createOpportunity(T, { oppNo: "OPP-003", leadId: "lead-1", projectId: PROJ });

    await expect(svc.handoffToBooking(T, "OPP-003", "bk-1")).rejects.toThrow(ConflictException);

    await svc.moveStage(T, "OPP-003", "qualification");
    await svc.moveStage(T, "OPP-003", "unit_interest");
    await svc.moveStage(T, "OPP-003", "site_visit");
    await svc.moveStage(T, "OPP-003", "offer");
    await svc.moveStage(T, "OPP-003", "hold");

    const won = await svc.handoffToBooking(T, "OPP-003", "bk-1");
    expect(won.stage).toBe("won");
    expect(won.bookingId).toBe("bk-1");
    expect(won.probabilityPct).toBe(100);
    expect(f.db.leads[0]!.status).toBe("won"); // attribution continuity
  });

  it("marks lost with mandatory reason and zero probability", async () => {
    await svc.createOpportunity(T, { oppNo: "OPP-004", leadId: "lead-1", projectId: PROJ });
    await expect(svc.markLost(T, "OPP-004", "")).rejects.toThrow(BadRequestException);

    const lost = await svc.markLost(T, "OPP-004", "price_too_high", "Competitor X");
    expect(lost.stage).toBe("lost");
    expect(lost.probabilityPct).toBe(0);
  });

  it("computes weighted pipeline forecast across open stages", async () => {
    f.db.opps.push({ id: "o1", tenantId: T, projectId: PROJ, stage: "offer", probabilityPct: 70, expectedValuePaise: 100_00_000_00n });
    f.db.opps.push({ id: "o2", tenantId: T, projectId: PROJ, stage: "prospect", probabilityPct: 10, expectedValuePaise: 50_00_000_00n });
    f.db.opps.push({ id: "o3", tenantId: T, projectId: PROJ, stage: "won", probabilityPct: 100, expectedValuePaise: 200_00_000_00n });
    f.db.opps.push({ id: "o4", tenantId: T, projectId: PROJ, stage: "lost", probabilityPct: 0, expectedValuePaise: 90_00_000_00n });

    const fc = await svc.forecast(T, PROJ);
    expect(fc.openCount).toBe(2);
    expect(fc.grossPipelinePaise).toBe(150_00_000_00n);
    // Weighted: 100Cr*70% + 50Cr*10% = 70Cr + 5Cr = 75Cr
    expect(fc.weightedPipelinePaise).toBe(75_00_000_00n);
    expect(fc.wonPaise).toBe(200_00_000_00n);
    expect(fc.lostCount).toBe(1);
  });

  it("logs lead assignment history with from → to and reason", async () => {
    const log = await svc.assignLead(T, "lead-1", "rep-2", "manager-1", "reassign");
    expect(log.fromUserId).toBe("rep-1");
    expect(log.toUserId).toBe("rep-2");
    expect(log.reason).toBe("reassign");
    expect(f.db.leads[0]!.assignedUserId).toBe("rep-2");

    const history = await svc.assignmentHistory(T, "lead-1");
    expect(history).toHaveLength(1);

    // Won/lost leads cannot be reassigned
    f.db.leads[0]!.status = "won";
    await expect(svc.assignLead(T, "lead-1", "rep-3", "manager-1", "manual")).rejects.toThrow(ConflictException);
  });

  it("walks site visit lifecycle: scheduled → confirmed → done with outcome; no-show branch", async () => {
    f.db.visits.push({ id: "v1", tenantId: T, leadId: "lead-1", status: "scheduled" });

    await svc.confirmVisit(T, "v1");
    expect(f.db.visits[0]!.status).toBe("confirmed");

    // Cannot mark no-show after completion
    const done = await svc.completeVisit(T, "v1", "interested", "Wants 3bhk east facing");
    expect(done.status).toBe("done");
    expect(done.outcome).toBe("interested");

    f.db.visits.push({ id: "v2", tenantId: T, leadId: "lead-1", status: "scheduled" });
    await svc.markNoShow(T, "v2");
    expect(f.db.visits[1]!.status).toBe("no_show");
  });

  it("computes visit→opportunity conversion funnel", async () => {
    f.db.visits.push(
      { id: "v1", tenantId: T, leadId: "lead-1", status: "done" },
      { id: "v2", tenantId: T, leadId: "lead-2", status: "done" },
      { id: "v3", tenantId: T, leadId: "lead-3", status: "no_show" },
    );
    f.db.opps.push({ id: "o1", tenantId: T, leadId: "lead-1", stage: "offer" }); // only lead-1 has opportunity

    const funnel = await svc.visitFunnel(T);
    expect(funnel.completed).toBe(2);
    expect(funnel.noShow).toBe(1);
    expect(funnel.completionPct).toBe(67); // 2 of 3
    expect(funnel.visitToOpportunityPct).toBe(50); // 1 of 2 completed visits
  });
});
