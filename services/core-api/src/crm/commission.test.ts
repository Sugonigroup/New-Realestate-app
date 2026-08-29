import { describe, expect, it, vi } from "vitest";
import { Money } from "@buildos/money-utils";
import { accrueCommission, creditDecision, tdsOnCommission, type CommissionPlanShape } from "./commission.js";
import { CommissionService } from "./commission.service.js";

describe("commission math (WP-1E, BR-H)", () => {
  const flat: CommissionPlanShape = { kind: "flat", rateBps: 200, tdsBps: 200 }; // 2%

  it("flat 2% on realized value, exact paise", () => {
    expect(accrueCommission(flat, Money.fromPaise(50_000_000n)).formatIndian()).toBe("10,000.00"); // 2% of ₹5L
    expect(accrueCommission(flat, Money.fromPaise(99999999n)).paise).toBe(2000000n); // half-up
  });

  const slab: CommissionPlanShape = {
    kind: "slab",
    rateBps: 0,
    tdsBps: 200,
    slabs: [
      { fromPaise: 0n, toPaise: 1_00_000_00n, rateBps: 100 }, // first ₹1L @1%
      { fromPaise: 1_00_000_00n, toPaise: 3_00_000_00n, rateBps: 200 }, // next ₹2L @2%
      { fromPaise: 3_00_000_00n, toPaise: null, rateBps: 300 }, // beyond @3%
    ],
  };

  it("progressive slabs: each tier earns on its slice only", () => {
    // realized ₹2.5L: 1L@1% (100000) + 1.5L@2% (300000) = ₹4,000
    expect(accrueCommission(slab, Money.fromPaise(25_000_000n)).formatIndian()).toBe("4,000.00");
    // realized ₹5L: 100000 + 400000 + 2L@3% (600000) = ₹11,000
    expect(accrueCommission(slab, Money.fromPaise(50_000_000n)).formatIndian()).toBe("11,000.00");
    // realized ₹50,000: entirely in tier 1
    expect(accrueCommission(slab, Money.fromPaise(5_000_000n)).formatIndian()).toBe("500.00");
  });

  it("TDS 194H deducts from gross", () => {
    expect(tdsOnCommission(Money.fromPaise(1_000_000n), 200).paise).toBe(20000n);
  });

  it("credit window: first-touch wins, window enforced", () => {
    const t0 = new Date("2026-01-01");
    expect(
      creditDecision({
        leadCreatedAt: new Date("2026-01-10"),
        partnerImportedAt: new Date("2026-01-05"),
        houseLeadCreatedAt: null,
        windowDays: 30,
      }),
    ).toMatchObject({ creditedTo: "partner" });
    expect(
      creditDecision({
        leadCreatedAt: new Date("2026-01-10"),
        partnerImportedAt: new Date("2026-01-05"),
        houseLeadCreatedAt: new Date("2026-01-02"),
        windowDays: 30,
      }),
    ).toMatchObject({ creditedTo: "house", reason: /first-touch/ });
    expect(
      creditDecision({
        leadCreatedAt: new Date("2026-03-10"),
        partnerImportedAt: new Date("2026-01-05"),
        houseLeadCreatedAt: null,
        windowDays: 30,
      }),
    ).toMatchObject({ creditedTo: "house", reason: /credit window/ });
  });
});

describe("CommissionService (WP-1E)", () => {
  function makeFake(opts?: { partnerStatus?: string; plan?: Record<string, unknown> }) {
    const db = {
      ledger: [] as Array<{ id: string; status?: string; accruedPaise?: bigint; [key: string]: unknown }>,
      payouts: [] as Array<Record<string, unknown> & { id: string; status?: string; entryIds?: string[] }>,
    };
    const prisma = {
      booking: { findFirst: vi.fn(async () => ({ id: "bk-1", leadId: "lead-1", projectId: "proj-1" })) },
      lead: { findFirst: vi.fn(async () => ({ id: "lead-1", source: "partner", sourceRef: "cp-1" })) },
      channelPartner: {
        findFirst: vi.fn(async ({ where }: { where: { status?: string } }) => {
          const partner = {
            id: "cp-1",
            status: opts?.partnerStatus ?? "active",
            reraAgentNo: "A12345",
            reraAgentExpiry: new Date(Date.now() + 86_400_000),
          };
          if (where.status && partner.status !== where.status) return null;
          return partner;
        }),
      },
      partnerPanel: {
        findFirst: vi.fn(async () => ({ id: "panel-1", active: true })),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "panel-new", ...data })),
      },
      commissionPlan: { findFirst: vi.fn(async () => opts?.plan ?? { kind: "flat", rateBps: 200, tdsBps: 200 }) },
      commissionLedgerEntry: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { status: "accrued", reversedPaise: 0n, ...data, id: `cl-${db.ledger.length + 1}` };
          db.ledger.push(row);
          return row;
        }),
        findMany: vi.fn(async ({ where }: { where: { status?: string } }) =>
          db.ledger.filter((l) => !where.status || (l.status ?? "accrued") === where.status),
        ),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = db.ledger.find((l) => l.id === where.id)!;
          Object.assign(row, data);
          return row;
        }),
      },
      payoutBatch: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, id: `pb-1` };
          db.payouts.push(row);
          return row;
        }),
        findFirst: vi.fn(async ({ where }: { where: { id: string } }) => db.payouts.find((p) => p.id === where.id)),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = db.payouts.find((p) => p.id === where.id)!;
          Object.assign(row, data);
          return row;
        }),
      },
    };
    const svc = new CommissionService(prisma as never);
    return { svc, db };
  }

  it("accrues 2% on a cleared receipt for a panelled active partner", async () => {
    const { svc, db } = makeFake();
    const out = await svc.onReceiptCleared("t-1", "bk-1", 50_000_000n);
    expect(out.accrued).toBe(true);
    expect(out.amountPaise).toBe("1000000"); // ₹1,00,000
    expect(db.ledger[0]).toMatchObject({ partnerId: "cp-1", status: "accrued", sourceEvent: "receipt.cleared.v1" });
  });

  it("declines accrual for non-active partners or missing panels", async () => {
    const suspended = await makeFake({ partnerStatus: "suspended" }).svc.onReceiptCleared("t-1", "bk-1", 1n);
    expect(suspended).toMatchObject({ accrued: false, reason: "partner not active" });
  });

  it("clawback reverses open accrued entries on cancellation", async () => {
    const { svc, db } = makeFake();
    await svc.onReceiptCleared("t-1", "bk-1", 50_000_000n);
    const out = await svc.onBookingCancelled("t-1", "bk-1");
    expect(out.entries).toBe(1);
    expect(out.reversedPaise).toBe("1000000");
    expect(db.ledger[0]!.status).toBe("reversed");
  });

  it("payout batch: gross − TDS 194H = net; approval marks entries paid", async () => {
    const { svc, db } = makeFake();
    await svc.onReceiptCleared("t-1", "bk-1", 50_000_000n); // accrue ₹1,00,000
    const batch = (await svc.createPayout("t-1", "cp-1", { kind: "flat", rateBps: 200, tdsBps: 200 })) as {
      grossPaise: bigint;
      tdsPaise: bigint;
      netPaise: bigint;
      id: string;
    };
    expect(batch.grossPaise).toBe(1000000n);
    expect(batch.tdsPaise).toBe(20000n); // 2% TDS
    expect(batch.netPaise).toBe(980000n);

    const approved = (await svc.approvePayout("t-1", batch.id, "cfo-1")) as { status: string };
    expect(approved.status).toBe("approved");
    expect(db.ledger[0]!.status).toBe("paid");
  });

  it("RERA agent gate blocks panels without valid agent registration", async () => {
    const { svc } = makeFake({
      partnerStatus: "active",
      plan: { kind: "flat", rateBps: 200, tdsBps: 200 },
    });
    const { svc: svcNoAgent } = makeFake();
    void svc;
    // partner without reraAgentNo
    const prismaNoAgent = svcNoAgent as unknown as {
      prisma: { channelPartner: { findFirst: ReturnType<typeof vi.fn> } };
    };
    prismaNoAgent.prisma.channelPartner.findFirst.mockResolvedValue({
      id: "cp-1", status: "active", reraAgentNo: null, reraAgentExpiry: null,
    });
    await expect(svcNoAgent.addToPanel("t-1", "cp-1", "proj-1", "head-1")).rejects.toThrow(/RERA agent/);
  });
});
