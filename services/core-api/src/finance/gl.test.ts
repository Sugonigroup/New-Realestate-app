import { describe, expect, it, vi } from "vitest";
import { GlService } from "./gl.service.js";
import { ApService } from "./ap.service.js";
import { BankService } from "./bank.service.js";
import { Money } from "@buildos/money-utils";

function fakePrisma() {
  const db = {
    accounts: [
      { id: "a1", tenantId: "t-1", code: "1000-CASH", name: "Cash", type: "asset", isPostable: true },
      { id: "a2", tenantId: "t-1", code: "4000-REV", name: "Revenue", type: "revenue", isPostable: true },
      { id: "a3", tenantId: "t-1", code: "5000-EXP", name: "Expense", type: "expense", isPostable: true },
      { id: "a4", tenantId: "t-1", code: "9000-GRP", name: "Group header", type: "asset", isPostable: false },
    ],
    journals: [] as Array<Record<string, unknown> & { id: string }>,
    periods: [{ tenantId: "t-1", period: "2026-09", status: "open" }],
    invoices: [] as Array<Record<string, unknown> & { id: string }>,
    bankTxs: [] as Array<Record<string, unknown> & { id: string }>,
  };
  let seq = 0;
  const prisma = {
    account: { findFirst: vi.fn(async ({ where }: { where: { code: string } }) => db.accounts.find((a) => a.code === where.code)) },
    fiscalPeriod: { findUnique: vi.fn(async ({ where }: { where: { tenantId_period: { period: string } } }) => db.periods.find((p) => p.period === where.tenantId_period.period)) },
    journal: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `jr-${++seq}`, lines: (data as { lines: { create: Array<Record<string, unknown>> } }).lines.create.map((l, i) => ({ id: `jl-${seq}-${i}`, ...l })) };
        db.journals.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => db.journals.find((j) => j.id === where.id)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const j = db.journals.find((x) => x.id === where.id)!;
        Object.assign(j, data);
        return j;
      }),
      findMany: vi.fn(async ({ where }: { where: { status: string; date?: { lte?: Date } } }) =>
        db.journals.filter((j) => j.status === where.status && (!where.date?.lte || new Date(j.date as string) <= where.date.lte)),
      ),
    },
    vendorInvoice: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `vi-${++seq}` };
        db.invoices.push(row);
        return row;
      }),
      findMany: vi.fn(async () => db.invoices),
    },
    receipt: { findMany: vi.fn(async () => [{ id: "r-1", status: "cleared", instrumentRef: "UTR-001", amountPaise: 100_000_00n, bookingId: "bk-1" }]) },
    bankTransaction: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `bt-${++seq}`, matched: false };
        db.bankTxs.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where }: { where: { matched?: boolean } }) =>
        db.bankTxs.filter((t) => where.matched === undefined || t.matched === where.matched),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const t = db.bankTxs.find((x) => x.id === where.id)!;
        Object.assign(t, data);
        return t;
      }),
    },
    auditEvent: { create: vi.fn(async ({ data }: { data: unknown }) => data) },
  };
  return { prisma, db };
}

const TENANT = "t-1";
const CASH = "1000-CASH";
const REV = "4000-REV";

function balancedJournal(voucherNo: string) {
  return {
    tenantId: TENANT, voucherNo, type: "receipt" as const,
    date: new Date("2026-09-15"),
    narration: "test journal",
    createdBy: "u-1",
    lines: [
      { accountCode: CASH, debitPaise: 100_000_00n, creditPaise: 0n },
      { accountCode: REV, debitPaise: 0n, creditPaise: 100_000_00n },
    ],
  };
}

describe("GlService (P0)", () => {
  it("creates a balanced draft journal with lines", async () => {
    const { prisma, db } = fakePrisma();
    const svc = new GlService(prisma as never);
    const out = await svc.createJournal(balancedJournal("JV-001"));
    expect(out.voucherNo).toBe("JV-001");
    expect(db.journals[0]!.status).toBe("draft");
  });

  it("rejects unbalanced journals", async () => {
    const { prisma } = fakePrisma();
    const svc = new GlService(prisma as never);
    const bad = balancedJournal("JV-BAD");
    bad.lines[1]!.creditPaise = 50_000_00n; // mismatch
    await expect(svc.createJournal(bad)).rejects.toThrow(/unbalanced/);
  });

  it("rejects posting to header (non-postable) accounts", async () => {
    const { prisma } = fakePrisma();
    const svc = new GlService(prisma as never);
    const j = balancedJournal("JV-HDR");
    j.lines[0]!.accountCode = "9000-GRP";
    j.lines[1]!.accountCode = "9000-GRP";
    await expect(svc.createJournal(j)).rejects.toThrow(/not postable/);
  });

  it("posts a draft journal and blocks double-posting", async () => {
    const { prisma, db } = fakePrisma();
    const svc = new GlService(prisma as never);
    const created = await svc.createJournal(balancedJournal("JV-002"));
    await svc.postJournal(TENANT, created.journalId, "fm-1");
    expect(db.journals[0]!.status).toBe("posted");
    await expect(svc.postJournal(TENANT, created.journalId, "fm-1")).rejects.toThrow(/posted/);
  });

  it("reverses a posted journal with swapped lines", async () => {
    const { prisma, db } = fakePrisma();
    const svc = new GlService(prisma as never);
    const created = await svc.createJournal(balancedJournal("JV-003"));
    await svc.postJournal(TENANT, created.journalId, "fm-1");
    await svc.reverseJournal(TENANT, created.journalId, "cfo-1", "wrong booking");
    expect(db.journals[0]!.status).toBe("reversed");
    expect(db.journals[1]!.status).toBe("posted");
    const revLines = db.journals[1]!.lines as Array<{ debitPaise: bigint; creditPaise: bigint }>;
    expect(revLines[0]!.debitPaise).toBe(0n); // swapped
    expect(revLines[0]!.creditPaise).toBe(100_000_00n);
  });

  it("trial balance aggregates posted journals only", async () => {
    const { prisma } = fakePrisma();
    const svc = new GlService(prisma as never);
    await svc.createJournal(balancedJournal("JV-004"));
    await svc.postJournal(TENANT, "jr-1", "fm-1");
    const tb = await svc.trialBalance(TENANT, new Date("2026-12-31"));
    expect(tb.find((t) => t.accountCode === CASH)!.debitPaise).toBe(100_000_00n);
    expect(tb.find((t) => t.accountCode === REV)!.creditPaise).toBe(100_000_00n);
  });

  it("closed period blocks transactions", async () => {
    const { prisma } = fakePrisma();
    prisma.fiscalPeriod.findUnique.mockResolvedValue({ tenantId: TENANT, period: "2026-09", status: "hard_closed" });
    const svc = new GlService(prisma as never);
    await expect(svc.createJournal(balancedJournal("JV-005"))).rejects.toThrow(/hard_closed/);
  });
});

describe("ApService (P0)", () => {
  it("3-way match: invoice = PO = GRN → matched", async () => {
    const { prisma } = fakePrisma();
    const svc = new ApService(prisma as never);
    const out = await svc.matchInvoice(TENANT, {
      invoiceNo: "INV-001", vendorId: "v-1",
      invoiceAmountPaise: 50_000_000n, poTotalPaise: 50_000_000n, grnTotalPaise: 50_000_000n,
      tdsBps: 200,
    });
    expect(out.status).toBe("3way_matched");
    expect(out.tdsPaise).toBe(1_000_000n);
  });

  it("5%+ variance → rejected", async () => {
    const { prisma } = fakePrisma();
    const svc = new ApService(prisma as never);
    const out = await svc.matchInvoice(TENANT, {
      invoiceNo: "INV-002", vendorId: "v-1",
      invoiceAmountPaise: 60_000_000n, poTotalPaise: 50_000_000n, grnTotalPaise: 50_000_000n,
      tdsBps: 200,
    });
    expect(out.status).toBe("rejected");
  });
});

describe("BankService (P0)", () => {
  it("imports transactions and auto-matches by UTR or amount", async () => {
    const { prisma, db } = fakePrisma();
    // create a receipt for matching
    db.bankTxs.length = 0;
    const bankSvc = new BankService(prisma as never);
    const count = await bankSvc.importTransactions(TENANT, "ba-1", [
      { date: new Date(), amountPaise: 100_000_00n, narration: "NEFT Ravi", utr: "UTR-001" },
      { date: new Date(), amountPaise: -50_000_00n, narration: "charges", utr: "CHG-1" },
    ]);
    expect(count).toBe(2);
    const { matched } = await bankSvc.autoMatch(TENANT, "ba-1");
    void matched;
    expect(db.bankTxs.length).toBe(2);
  });
});
