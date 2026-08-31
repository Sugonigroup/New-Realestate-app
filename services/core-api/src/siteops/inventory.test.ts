import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    stock: [] as Row[],
    ledger: [] as Row[],
    counts: [] as Row[],
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
    materialStock: {
      findFirst: vi.fn(async ({ where }: any) => db.stock.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.stock.filter(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("stk"), ...data }; db.stock.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.stock.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    stockLedger: {
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("led"), ...data }; db.ledger.push(r); return r; }),
      findMany: vi.fn(async ({ where }: any) => db.ledger.filter(match(where))),
    },
    stockCount: {
      findFirst: vi.fn(async ({ where }: any) => db.counts.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("cnt"), ...data }; db.counts.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.counts.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";
const PA = "aaaaaaaa-1111-1111-1111-111111111111";
const PB = "bbbbbbbb-2222-2222-2222-222222222222";

describe("InventoryService (INV-01)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: InventoryService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new InventoryService(f.prisma as never);
  });

  it("computes weighted average cost across receipts of differing unit prices", async () => {
    // Receipt 1: 100 bags @ ₹400 (40_000 paise) → stock 100, WAC 40_000
    await svc.receiveStock(T, {
      projectId: PA, materialId: "M-CEM", materialName: "Cement OPC 53", unit: "bag",
      qty: 100, unitCostPaise: 40_000n, refDocNo: "GRN-1",
    });
    // Receipt 2: 100 bags @ ₹440 (44_000 paise) → stock 200, WAC (100*40000 + 100*44000)/200 = 42_000
    const r2 = await svc.receiveStock(T, {
      projectId: PA, materialId: "M-CEM", materialName: "Cement OPC 53", unit: "bag",
      qty: 100, unitCostPaise: 44_000n, refDocNo: "GRN-2",
    });
    expect(r2.qtyAfter).toBe(200);
    expect(r2.wacPaise).toBe(42_000n);
    expect(f.db.ledger).toHaveLength(2);
  });

  it("issues stock at current WAC and rejects over-issue beyond available quantity", async () => {
    await svc.receiveStock(T, {
      projectId: PA, materialId: "M-STEEL", materialName: "TMT Bar 12mm", unit: "kg",
      qty: 1000, unitCostPaise: 6_500n, refDocNo: "GRN-3",
    });

    await expect(svc.issueStock(T, {
      projectId: PA, materialId: "M-STEEL", qty: 1500, refDocNo: "ISS-X",
    })).rejects.toThrow(BadRequestException);

    const issued = await svc.issueStock(T, {
      projectId: PA, materialId: "M-STEEL", qty: 400, refDocNo: "ISS-1",
    });
    expect(issued.qtyAfter).toBe(600);
    expect(issued.valuedAtWacPaise).toBe(6_500n); // valued at WAC
  });

  it("transfers stock between projects preserving WAC valuation", async () => {
    await svc.receiveStock(T, {
      projectId: PA, materialId: "M-SAND", materialName: "River Sand", unit: "cum",
      qty: 500, unitCostPaise: 28_000n, refDocNo: "GRN-4",
    });

    const res = await svc.transferStock(T, {
      fromProjectId: PA, toProjectId: PB, materialId: "M-SAND", qty: 200, refDocNo: "TRF-1",
    });
    expect(res.valuedAtWacPaise).toBe(28_000n);

    // Source reduced to 300, destination created with 200
    const src = f.db.stock.find((s) => s.projectId === PA)!;
    const dst = f.db.stock.find((s) => s.projectId === PB)!;
    expect(Number(src.stockQty)).toBe(300);
    expect(Number(dst.stockQty)).toBe(200);
    // Transfer writes issue + grn_in ledger entries (ref same doc)
    const trfEntries = f.db.ledger.filter((l) => l.refDocNo === "TRF-1");
    expect(trfEntries).toHaveLength(2);
  });

  it("records cycle count variance and applies approved adjustment to stock + ledger", async () => {
    await svc.receiveStock(T, {
      projectId: PA, materialId: "M-BRICK", materialName: "AAC Blocks", unit: "nos",
      qty: 1000, unitCostPaise: 5_200n, refDocNo: "GRN-5",
    });

    // Count shows only 950 on hand → variance -50 (-5%)
    const count = await svc.recordCycleCount(T, {
      countNo: "CNT-1", projectId: PA, materialId: "M-BRICK", countedQty: 950,
    });
    expect(Number(count.varianceQty)).toBe(-50);
    expect(Number(count.variancePct)).toBe(-5);

    await expect(svc.applyCountAdjustment(T, "CNT-1", "auditor-1")).resolves.toMatchObject({ status: "adjusted" });

    const stock = f.db.stock.find((s) => s.materialId === "M-BRICK")!;
    expect(Number(stock.stockQty)).toBe(950);

    // Cannot adjust twice
    await expect(svc.applyCountAdjustment(T, "CNT-1", "auditor-1")).rejects.toThrow(ConflictException);
  });

  it("generates reorder report sorted by coverage with REORDER_NOW alerts including inbound PO qty", async () => {
    // Cement: 50 bags, daily use 10, safety 3 days → reorder level 30; inbound PO 100 → effective 150 > 30
    f.db.stock.push({
      id: "s1", tenantId: T, projectId: PA, materialId: "M-CEM", materialName: "Cement",
      unit: "bag", stockQty: 50, avgDailyConsumption: 10, inboundPoQty: 100, leadTimeDays: 7, safetyDays: 3, wacPaise: 40_000n,
    });
    // Steel: 20 kg, daily 10, safety 3 → reorder level 30, no inbound → REORDER_NOW
    f.db.stock.push({
      id: "s2", tenantId: T, projectId: PA, materialId: "M-STEEL", materialName: "TMT 12mm",
      unit: "kg", stockQty: 20, avgDailyConsumption: 10, inboundPoQty: 0, leadTimeDays: 7, safetyDays: 3, wacPaise: 6_500n,
    });

    const report = await svc.reorderReport(T, PA);
    expect(report).toHaveLength(2);
    expect(report[0]!.materialId).toBe("M-STEEL"); // lowest coverage first (2 days)
    expect(report[0]!.alert).toBe("REORDER_NOW");
    expect(report[1]!.materialId).toBe("M-CEM");
    // Not REORDER_NOW (inbound PO 100 covers the reorder level), but only 5 days coverage
    // vs 10 days (lead 7 + safety 3) → REORDER_SOON is the correct alert
    expect(report[1]!.alert).toBe("REORDER_SOON");
  });
});
