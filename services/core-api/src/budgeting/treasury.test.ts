import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { TreasuryService } from "./treasury.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    facilities: [] as Row[],
    txns: [] as Row[],
    snapshots: [] as Row[],
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
    debtFacility: {
      findFirst: vi.fn(async ({ where }: any) => db.facilities.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.facilities.filter(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("fac"), drawnPaise: 0n, repaidPaise: 0n, ...data }; db.facilities.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.facilities.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    debtTransaction: {
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("txn"), ...data }; db.txns.push(r); return r; }),
    },
    cashForecastSnapshot: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.tenantId_period.tenantId}:${where.tenantId_period.period}`;
        const existing = db.snapshots.find((x) => `${x.tenantId}:${x.period}` === key);
        if (!existing) {
          const fresh = { id: nid("cfs"), ...create };
          db.snapshots.push(fresh);
          return fresh;
        }
        Object.assign(existing, update);
        return existing;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("TreasuryService (FPA-02)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: TreasuryService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new TreasuryService(f.prisma as never);
  });

  it("draws down within sanctioned limit and rejects over-drawdown", async () => {
    // Construction finance ₹100 Cr at 10.5% p.a., 36 months
    await svc.createFacility(T, {
      facilityNo: "CF-001", lenderName: "HDFC Bank", facilityType: "construction_finance",
      sanctionedPaise: 100_00_00_000_00n, annualRateBps: 1050, tenureMonths: 36,
    });

    const d1 = await svc.drawdown(T, "CF-001", 40_00_00_000_00n); // ₹40 Cr
    expect(d1.txnType).toBe("drawdown");

    await expect(svc.drawdown(T, "CF-001", 70_00_00_000_00n)) // total ₹110 Cr > ₹100 Cr
      .rejects.toThrow(BadRequestException);
  });

  it("repays within outstanding and closes the facility on full settlement", async () => {
    await svc.createFacility(T, {
      facilityNo: "TL-001", lenderName: "ICICI Bank", facilityType: "term_loan",
      sanctionedPaise: 10_00_00_000n, annualRateBps: 1200, tenureMonths: 24,
    });
    await svc.drawdown(T, "TL-001", 10_00_00_000n); // ₹10 Lakh

    await expect(svc.repay(T, "TL-001", 15_00_00_000n)).rejects.toThrow(BadRequestException);

    await svc.repay(T, "TL-001", 4_00_00_000n); // ₹4 Lakh partial
    expect(f.db.facilities[0]!.status).toBe("active");

    await svc.repay(T, "TL-001", 6_00_00_000n); // remaining ₹6 Lakh
    expect(f.db.facilities[0]!.status).toBe("closed");
    expect(f.db.facilities[0]!.repaidPaise).toBe(10_00_00_000n);
  });

  it("computes monthly reducing-balance interest forecast on outstanding principal", async () => {
    await svc.createFacility(T, {
      facilityNo: "CF-002", lenderName: "SBI", facilityType: "construction_finance",
      sanctionedPaise: 100_00_00_000_00n, annualRateBps: 1050, tenureMonths: 36,
    });
    await svc.drawdown(T, "CF-002", 60_00_00_000_00n); // ₹60 Cr outstanding

    const forecast = await svc.interestForecast(T, "CF-002");
    expect(forecast.outstandingPaise).toBe(60_00_00_000_00n);
    // Monthly interest = 60Cr * 10.5% / 12 = ₹52.50 Lakh (52_50_00_000 paise)
    expect(forecast.monthlyInterestPaise).toBe(52_50_00_000n);
    // First year total = 52.5L * 12 = ₹6.30 Cr (630_00_00_000 paise)
    expect(forecast.totalInterestFirstYearPaise).toBe(630_00_00_000n);
    expect(forecast.schedule).toHaveLength(36);
  });

  it("aggregates portfolio position: sanctioned, drawn, outstanding, and monthly interest burn", async () => {
    await svc.createFacility(T, {
      facilityNo: "CF-A", lenderName: "HDFC", facilityType: "construction_finance",
      sanctionedPaise: 100_00_00_000_00n, annualRateBps: 1050, tenureMonths: 36,
    });
    await svc.createFacility(T, {
      facilityNo: "LAP-B", lenderName: "Axis", facilityType: "lap",
      sanctionedPaise: 30_00_00_000_00n, annualRateBps: 960, tenureMonths: 60,
    });
    await svc.drawdown(T, "CF-A", 50_00_00_000_00n); // ₹50 Cr @10.5%
    await svc.drawdown(T, "LAP-B", 30_00_00_000_00n); // ₹30 Cr @9.6%

    const pos = await svc.portfolioPosition(T);
    expect(pos.activeFacilities).toBe(2);
    expect(pos.totalOutstandingPaise).toBe(80_00_00_000_00n);
    // Monthly interest: 50Cr*10.5%/12 = 43.75L + 30Cr*9.6%/12 = 24L → ₹67.75 Lakh
    expect(pos.monthlyInterestPaise).toBe(67_75_00_000n);
  });

  it("records cash runway snapshot and computes months of runway at current burn rate", async () => {
    // Opening ₹90 Cr, inflow ₹20 Cr, outflow ₹50 Cr → net -₹30 Cr burn, closing ₹60 Cr → runway 2 months
    const snap = await svc.cashRunway(T, "2026-09", 90_00_00_000_00n, 20_00_00_000_00n, 50_00_00_000_00n);
    expect(snap.closingPaise).toBe(60_00_00_000_00n);
    expect(snap.burnRatePaise).toBe(30_00_00_000_00n);
    expect(Number(snap.runwayMonths)).toBe(2);
  });
});
