import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AssetsService } from "./assets.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    assets: [] as Row[],
    plans: [] as Row[],
    workOrders: [] as Row[],
    spares: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      return row[k] === v;
    });
  }

  const prisma = {
    asset: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const a = db.assets.find(match(where));
        if (!a) return null;
        const res = { ...a };
        if (include?.plans) res.plans = db.plans.filter((x) => x.assetId === a.id);
        return res;
      }),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("ast"), currentMeterVal: 0, ...data };
        db.assets.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.assets.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    maintenancePlan: {
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("pln"), ...data };
        db.plans.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.plans.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    workOrder: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const wo = db.workOrders.find(match(where));
        if (!wo) return null;
        const res = { ...wo };
        if (include?.asset) res.asset = db.assets.find((x) => x.id === wo.assetId);
        if (include?.plan) res.plan = db.plans.find((x) => x.id === wo.planId);
        return res;
      }),
      findMany: vi.fn(async ({ where }: any) => db.workOrders.filter(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("wo"), createdAt: new Date(), costPaise: 0n, ...data };
        db.workOrders.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.workOrders.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    spareUsage: {
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("spr"), ...data };
        db.spares.push(r);
        return r;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("AssetsService", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: AssetsService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new AssetsService(f.prisma as never);
  });

  it("creates an asset and calculates SLM depreciation schedule accurately", async () => {
    // Crane purchased 12 months ago for ₹12L, salvage ₹0, 60 months life
    const purchaseDate = new Date();
    purchaseDate.setMonth(purchaseDate.getMonth() - 12);

    const asset = await svc.createAsset(T, {
      assetTag: "CRANE-01", name: "Tower Crane 10T", category: "heavy_machinery",
      purchaseDate, purchaseValPaise: 12_00_00_000n, salvageValPaise: 0n, usefulLifeMonths: 60,
    });
    expect(asset.assetTag).toBe("CRANE-01");

    const dep = await svc.depreciationSchedule(T, asset.id);
    expect(dep.monthlyDepreciationPaise).toBe(20_00_000n); // ₹20,000 / month
    expect(dep.monthsElapsed).toBe(12);
    expect(dep.accumulatedDepreciationPaise).toBe(2_40_00_000n); // ₹2.4L
    expect(dep.netBookValuePaise).toBe(9_60_00_000n); // ₹9.6L
    expect(dep.isFullyDepreciated).toBe(false);
  });

  it("records meter reading and triggers usage-based PM when threshold exceeded", async () => {
    const asset = await svc.createAsset(T, {
      assetTag: "EXCAV-01", name: "JCB Excavator", category: "heavy_machinery",
      purchaseDate: new Date(), purchaseValPaise: 50_00_000n, usefulLifeMonths: 36, meterUnit: "hours",
    });
    const plan = await svc.createPlan(T, asset.id, { title: "500-hour Hydraulic Service", meterInterval: 500 });
    expect(plan.title).toBe("500-hour Hydraulic Service");

    const res1 = await svc.recordMeterReading(T, asset.id, 250);
    expect(res1.PMsTriggeredCount).toBe(0);

    const res2 = await svc.recordMeterReading(T, asset.id, 510);
    expect(res2.PMsTriggeredCount).toBe(1);
    expect(res2.triggeredPlans[0]!.id).toBe(plan.id);
  });

  it("prevents meter reading regression", async () => {
    const asset = await svc.createAsset(T, {
      assetTag: "GEN-01", name: "Diesel Generator", category: "heavy_machinery",
      purchaseDate: new Date(), purchaseValPaise: 10_00_000n, usefulLifeMonths: 48,
    });
    await svc.recordMeterReading(T, asset.id, 100);
    await expect(svc.recordMeterReading(T, asset.id, 80)).rejects.toThrow(BadRequestException);
  });

  it("breakdown work order sets asset to in_maintenance and completion restores to in_service", async () => {
    const asset = await svc.createAsset(T, {
      assetTag: "PUMP-01", name: "Concrete Pump", category: "heavy_machinery",
      purchaseDate: new Date(), purchaseValPaise: 20_00_000n, usefulLifeMonths: 48,
    });

    const wo = await svc.createWorkOrder(T, {
      woNo: "WO-BD-01", assetId: asset.id, type: "breakdown", description: "Engine Overheat",
      breakdownAt: new Date(Date.now() - 3600000 * 4), // 4 hours ago
    });
    expect(f.db.assets[0]!.status).toBe("in_maintenance");

    const completed = await svc.completeWorkOrder(T, wo.woNo, {
      completedAt: new Date(),
      spares: [{ materialId: "M-OIL", qty: 2, unitCostPaise: 5_00_000n }],
    });
    expect(completed.status).toBe("completed");
    expect(completed.costPaise).toBe(10_00_000n); // 2 * ₹5,000 = ₹10,000
    expect(f.db.assets[0]!.status).toBe("in_service");
  });

  it("calculates MTBF and MTTR reliability KPIs from completed breakdown work orders", async () => {
    const asset = await svc.createAsset(T, {
      assetTag: "BATCH-01", name: "Batching Plant", category: "heavy_machinery",
      purchaseDate: new Date(Date.now() - 3600000 * 1000), // 1000 hours ago
      purchaseValPaise: 1_00_00_000n, usefulLifeMonths: 60, meterUnit: "hours",
    });
    f.db.assets[0]!.currentMeterVal = 1000;

    // Breakdown 1: 5 hours downtime
    const b1Start = new Date(Date.now() - 3600000 * 50);
    const b1End = new Date(b1Start.getTime() + 3600000 * 5);
    f.db.workOrders.push({
      id: "wo-b1", tenantId: T, woNo: "WO-B1", assetId: asset.id, type: "breakdown", status: "completed",
      breakdownAt: b1Start, completedAt: b1End,
    });

    // Breakdown 2: 3 hours downtime
    const b2Start = new Date(Date.now() - 3600000 * 20);
    const b2End = new Date(b2Start.getTime() + 3600000 * 3);
    f.db.workOrders.push({
      id: "wo-b2", tenantId: T, woNo: "WO-B2", assetId: asset.id, type: "breakdown", status: "completed",
      breakdownAt: b2Start, completedAt: b2End,
    });

    const rel = await svc.reliabilityMetrics(T, asset.id);
    expect(rel.failureCount).toBe(2);
    expect(rel.totalDowntimeHours).toBe(8);
    expect(rel.mttrHours).toBe(4); // 8h total downtime / 2 failures = 4 hours
    expect(rel.mtbfHours).toBe(496); // (1000 operating - 8 downtime) / 2 = 496 hours
  });
});
