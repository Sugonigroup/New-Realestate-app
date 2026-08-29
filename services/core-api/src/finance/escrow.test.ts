import { describe, expect, it, vi } from "vitest";
import { classifyReceipt, evaluateWithdrawal } from "./escrow.js";
import { EscrowService } from "./escrow.service.js";

const state = (over: Partial<Parameters<typeof evaluateWithdrawal>[0]>) => ({
  collectedPaise: 1_000_000_000n, // ₹1,00,00,000 collected
  withdrawnPaise: 0n,
  certifiedPct: 30,
  totalProjectCostPaise: 5_000_000_000n, // ₹5,00,00,000 cost benchmark
  ...over,
});

describe("RERA 70% escrow guard (BR-A)", () => {
  it("70% of collections must stay parked", () => {
    const g = evaluateWithdrawal(state({}), 0n);
    expect(g.parkedRequiredPaise).toBe(700_000_000n);
    expect(g.maxAdditionalPaise).toBe(300_000_000n); // 30% spendable
  });

  it("certified % caps withdrawals independently", () => {
    const g = evaluateWithdrawal(state({ certifiedPct: 10 }), 0n);
    expect(g.withdrawnCapPaise).toBe(500_000_000n); // 10% of ₹5Cr
    // spendable (30Cr-side) is smaller here → binding constraint is 30%
    expect(g.maxAdditionalPaise).toBe(300_000_000n);
  });

  it("blocks withdrawal beyond the guard; allows within it", () => {
    expect(evaluateWithdrawal(state({}), 400_000_000n).allowed).toBe(false);
    expect(evaluateWithdrawal(state({}), 200_000_000n).allowed).toBe(true);
    expect(evaluateWithdrawal(state({}), 0n).allowed).toBe(false);
  });

  it("detects breach when withdrawn exceeds spendable", () => {
    const g = evaluateWithdrawal(state({ withdrawnPaise: 350_000_000n }), 0n);
    expect(g.breach).toBe(true);
  });

  it("classifies receipts 70/30", () => {
    expect(classifyReceipt(1_000_000_000n)).toEqual({ parkedPaise: 700_000_000n, spendablePaise: 300_000_000n });
  });
});

describe("EscrowService (WP-2C)", () => {
  const account = {
    id: "esc-1",
    tenantId: "t-1",
    projectId: "proj-1",
    collectedPaise: 1_000_000_000n,
    withdrawnPaise: 0n,
    certifiedPct: 30,
    totalProjectCostPaise: 5_000_000_000n,
  };

  function makeFake() {
    const db = { withdrawals: [] as Array<Record<string, unknown> & { id: string }>, outbox: [] as unknown[] };
    const prisma = {
      escrowAccount: {
        findFirst: vi.fn(async () => account),
        findMany: vi.fn(async () => [account]),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          Object.assign(account, data);
          return account;
        }),
      },
      escrowWithdrawal: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, id: `ew-1` };
          db.withdrawals.push(row);
          return row;
        }),
        findFirst: vi.fn(async () => db.withdrawals[0]),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const w = db.withdrawals.find((x) => x.id === where.id)!;
          Object.assign(w, data);
          return w;
        }),
      },
      outboxEvent: { create: vi.fn(async ({ data }: { data: unknown }) => void db.outbox.push(data)) },
    };
    const svc = new EscrowService(prisma as never);
    return { svc, db, prisma };
  }

  it("withdrawal without Form 3/4 certificates is refused outright", async () => {
    const { svc } = makeFake();
    await expect(
      svc.requestWithdrawal("t-1", "proj-1", { amountPaise: 100_000_000n, requestedBy: "cfo-1" }),
    ).rejects.toThrow(/Form 3.*Form 4/);
  });

  it("withdrawal within guard: requested → approved updates counters", async () => {
    const { svc, db } = makeFake();
    const req = await svc.requestWithdrawal("t-1", "proj-1", {
      amountPaise: 200_000_000n,
      requestedBy: "cfo-1",
      form3Ref: "F3-1",
      form4Ref: "F4-1",
    });
    expect((req.guard as { allowed: boolean }).allowed).toBe(true);

    const approved = (await svc.approveWithdrawal("t-1", req.withdrawalId, "md-1")) as { status: string };
    expect(approved.status).toBe("approved");
    expect(account.withdrawnPaise).toBe(200_000_000n);
    expect(db.outbox).toHaveLength(0); // no breach
  });

  it("withdrawal beyond guard is rejected with the guard math in the reason", async () => {
    const { svc } = makeFake();
    await expect(
      svc.requestWithdrawal("t-1", "proj-1", {
        amountPaise: 400_000_000n,
        requestedBy: "cfo-1",
        form3Ref: "F3-1",
        form4Ref: "F4-1",
      }),
    ).rejects.toThrow(/exceeds guard/);
  });

  it("breach scan emits escrow.breach.v1 for over-withdrawn projects", async () => {
    const { svc, db } = makeFake();
    account.withdrawnPaise = 400_000_000n; // > 30% spendable (₹3,00,000)
    const breaches = (await svc.scanBreaches("t-1")) as Array<{ projectId: string }>;
    expect(breaches).toHaveLength(1);
    expect(breaches[0]!.projectId).toBe("proj-1");
    expect(db.outbox[0]).toMatchObject({ type: "escrow.breach.v1", aggregate: "escrow" });
  });
});
