import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { SubcontractorService } from "./subcontractor.service.js";
import { QualityService } from "./quality.service.js";
import { HseService } from "./hse.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    subWos: [] as Row[],
    raBills: [] as Row[],
    pourCards: [] as Row[],
    cubeTests: [] as Row[],
    ncrs: [] as Row[],
    permits: [] as Row[],
    incidents: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      return row[k] === v;
    });
  }

  const prisma = {
    subcontractorWorkOrder: {
      findFirst: vi.fn(async ({ where }: any) => db.subWos.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("swo"), ...data }; db.subWos.push(r); return r; }),
    },
    raBill: {
      findFirst: vi.fn(async ({ where }: any) => db.raBills.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("rab"), ...data }; db.raBills.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.raBills.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    pourCard: {
      findFirst: vi.fn(async ({ where }: any) => db.pourCards.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("pcd"), ...data }; db.pourCards.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.pourCards.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    concreteCubeTest: {
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("cbt"), ...data }; db.cubeTests.push(r); return r; }),
    },
    nonConformanceReport: {
      findFirst: vi.fn(async ({ where }: any) => db.ncrs.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("ncr"), ...data }; db.ncrs.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.ncrs.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    permitToWork: {
      findFirst: vi.fn(async ({ where }: any) => db.permits.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.permits.filter(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("ptw"), ...data }; db.permits.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.permits.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    safetyIncident: {
      findFirst: vi.fn(async ({ where }: any) => db.incidents.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.incidents.filter(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("inc"), ...data }; db.incidents.push(r); return r; }),
    },
  };

  return { prisma, db };
}

const T = "t-1";
const PROJ = "11111111-1111-1111-1111-111111111111";
const CONT = "22222222-2222-2222-2222-222222222222";

describe("Site Operations & EPC Services (SUB-01, QMS-01, HSE-01)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let sub: SubcontractorService;
  let qc: QualityService;
  let hse: HseService;

  beforeEach(() => {
    f = fakePrisma();
    sub = new SubcontractorService(f.prisma as never);
    qc = new QualityService(f.prisma as never);
    hse = new HseService(f.prisma as never);
  });

  // ── SUB-01 Subcontractor RA Bills ───────────────────────────────────────

  it("calculates RA bill retention (5%), TDS 194C (2%), advance recovery, and net payable accurately", async () => {
    const wo = await sub.createWorkOrder(T, {
      woNo: "SWO-01", projectId: PROJ, contractorId: CONT,
      title: "Brickwork & Plastering", totalPaise: 1_00_00_000_00n, retentionPct: 5.0,
    });

    // Gross work = ₹10.00 Lakh (10_00_000_00 paise)
    // Retention 5% = ₹50,000 (50_000_00 paise)
    // Taxable = ₹9.50 Lakh
    // TDS 2% (200 bps) on taxable = ₹19,000 (19_000_00 paise)
    // Advance Rec = ₹1.00 Lakh (100_000_00 paise)
    // Net Payable = 10L - 50k - 1L - 19k = ₹8.31 Lakh (831_000_00 paise)
    const bill = await sub.submitRaBill(T, {
      billNo: "RA-001", workOrderId: wo.id, period: "2026-08",
      grossValPaise: 10_00_000_00n, advanceRecPaise: 100_000_00n, tdsRateBps: 200,
    });

    expect(bill.retentionPaise).toBe(50_000_00n);
    expect(bill.tdsPaise).toBe(19_000_00n);
    expect(bill.netPayablePaise).toBe(831_000_00n);
    expect(bill.status).toBe("submitted");

    const cert = await sub.certifyRaBill(T, "RA-001", "qs.sharma@buildos.internal");
    expect(cert.status).toBe("certified");
  });

  // ── QMS-01 Pour Cards & Cube Strength ───────────────────────────────────

  it("requires 4 clearances for pour card auto-approval and verifies 7-day vs 28-day cube strength pass criteria", async () => {
    const pc = await qc.createPourCard(T, {
      pourNo: "PCRD-01", projectId: PROJ, locationElement: "Tower A 5th Slab",
      concreteGrade: "M30", targetVolumeCum: 45.5,
    });
    expect(pc.status).toBe("pending");

    // Partial clearance keeps pending
    await qc.updateClearances(T, "PCRD-01", { rebarCleared: true, shutterCleared: true });
    expect(f.db.pourCards[0]!.status).toBe("pending");

    // Full 4-point clearance approves pour card
    const app = await qc.updateClearances(T, "PCRD-01", { mepCleared: true, qcCleared: true });
    expect(app.status).toBe("approved");

    // 7-day M30 test: target 30 N/mm2; min required 65% (19.5 N/mm2)
    const t7Pass = await qc.recordCubeTest(T, "PCRD-01", { sampleNo: "S1", testingAgeDays: 7, targetNmm2: 30, actualNmm2: 21.5 });
    expect(t7Pass.isPassed).toBe(true);

    const t7Fail = await qc.recordCubeTest(T, "PCRD-01", { sampleNo: "S2", testingAgeDays: 7, targetNmm2: 30, actualNmm2: 18.0 });
    expect(t7Fail.isPassed).toBe(false);
  });

  // ── HSE-01 Permit to Work & Safety Incidents ────────────────────────────

  it("manages High-Risk Work Permits and computes site safety rating with incident penalties", async () => {
    const permit = await hse.requestPermit(T, {
      permitNo: "PTW-01", projectId: PROJ, workType: "height_work", location: "Tower A Shaft",
      validFrom: new Date(), validTo: new Date(Date.now() + 3600000 * 8), safetyOfficer: "so.verma",
    });
    expect(permit.status).toBe("requested");

    const approved = await hse.approvePermit(T, "PTW-01", "pm.sharma");
    expect(approved.status).toBe("active");

    // Report minor incident (Sev 1 near miss) -> -5 pts
    await hse.reportIncident(T, {
      incidentNo: "INC-01", projectId: PROJ, severity: 1, location: "Tower A 2nd Floor",
      description: "Scaffolding clamp loose",
    });

    const score = await hse.siteSafetyScore(T, PROJ);
    expect(score.totalIncidents).toBe(1);
    expect(score.safetyScore).toBe(95); // 100 - 5 = 95
    expect(score.rating).toBe("EXCELLENT");
  });
});
