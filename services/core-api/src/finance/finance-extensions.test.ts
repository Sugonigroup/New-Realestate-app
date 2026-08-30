import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { AdjustmentNoteService } from "./adjustment-note.service.js";
import { AgingDunningService } from "./aging-dunning.service.js";
import { EInvoiceService } from "./einvoice.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    notes: [] as Row[],
    demands: [] as Row[],
    einvoices: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(row[k]);
      return row[k] === v;
    });
  }

  const prisma = {
    creditDebitNote: {
      findFirst: vi.fn(async ({ where }: any) => db.notes.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("cdn"), ...data }; db.notes.push(r); return r; }),
    },
    demand: {
      findMany: vi.fn(async ({ where }: any) => db.demands.filter(match(where))),
    },
    eInvoiceRecord: {
      findFirst: vi.fn(async ({ where }: any) => db.einvoices.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("einv"), ...data }; db.einvoices.push(r); return r; }),
    },
  };

  const fakeGl = {
    createJournal: vi.fn(async () => ({ journalId: "jr-fake-01" })),
    postJournal: vi.fn(async () => ({ status: "posted" })),
  };

  return { prisma, fakeGl, db };
}

const T = "t-1";

describe("Finance Extensions (FIN-02 & TAX-01)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let noteSvc: AdjustmentNoteService;
  let agingSvc: AgingDunningService;
  let einvSvc: EInvoiceService;

  beforeEach(() => {
    f = fakePrisma();
    noteSvc = new AdjustmentNoteService(f.prisma as never, f.fakeGl as never);
    agingSvc = new AgingDunningService(f.prisma as never);
    einvSvc = new EInvoiceService(f.prisma as never);
  });

  it("issues a Customer Credit Note with GST 18% calculation and posts balanced GL entries", async () => {
    const note = await noteSvc.issueNote(T, {
      noteNo: "CRN-001", type: "customer_credit", partyId: "cust-1", refInvoiceNo: "INV-1001",
      amountPaise: 10_000_00n, // ₹10,000 base
      gstRateBps: 1800, // 18% GST = ₹1,800
      reason: "rate_difference", createdBy: "user-1",
    });

    expect(note.amountPaise).toBe(10_000_00n);
    expect(note.gstPaise).toBe(1_800_00n);
    expect(note.totalPaise).toBe(11_800_00n); // ₹11,800 total
    expect(f.fakeGl.createJournal).toHaveBeenCalled();
    expect(f.fakeGl.postJournal).toHaveBeenCalled();
  });

  it("calculates AR Aging buckets and dunning levels across customer demand milestones", async () => {
    const now = new Date("2026-08-30");

    // 15 days overdue -> Current (0-30d)
    f.db.demands.push({ id: "d1", tenantId: T, status: "issued", dueDate: new Date("2026-08-15"), amountPaise: 1_00_000_00n });
    // 45 days overdue -> Level 1 Notice (31-60d)
    f.db.demands.push({ id: "d2", tenantId: T, status: "overdue", dueDate: new Date("2026-07-16"), amountPaise: 2_00_000_00n });
    // 100 days overdue -> Level 3 Legal (>90d)
    f.db.demands.push({ id: "d3", tenantId: T, status: "overdue", dueDate: new Date("2026-05-22"), amountPaise: 5_00_000_00n });

    const report = await agingSvc.calculateArAging(T, now);
    expect(report.totalOutstandingPaise).toBe(8_00_000_00n);
    expect(report.buckets.currentPaise).toBe(1_00_000_00n);
    expect(report.buckets.b30to60Paise).toBe(2_00_000_00n);
    expect(report.buckets.b90PlusPaise).toBe(5_00_000_00n);
    expect(report.dunningSummary.level1NoticeCount).toBe(1);
    expect(report.dunningSummary.level3LegalCount).toBe(1);
  });

  it("calculates RERA 18% p.a. overdue interest accurately", async () => {
    const dueDate = new Date("2026-01-01");
    const asOfDate = new Date("2026-12-31"); // 364 days
    const principal = 100_000_00n; // ₹1,00,000

    const res = await agingSvc.calculateOverdueInterest(principal, dueDate, asOfDate, 1800);
    expect(res.daysOverdue).toBe(364);
    expect(res.interestPaise).toBe(17_950_68n); // ~17.95% of ₹1L = ₹17,950
    expect(res.totalWithInterestPaise).toBe(117_950_68n);
  });

  it("generates 64-char SHA256 IRN and calculates E-Way Bill validity based on distance", async () => {
    const einv = await einvSvc.generateEInvoice(T, {
      documentNo: "INV-2026-888", documentType: "INV", supplierGstin: "27AAAAA0000A1Z5",
      recipientGstin: "27BBBBB0000B1Z2", totalPaise: 1_00_000_00n, // ₹1.00 Lakh (> ₹50k threshold)
      distanceKm: 450, // 450 km = 3 days validity (1 day per 200 km)
    });

    expect(einv.irn).toHaveLength(64);
    expect(einv.ewayBillNo).toBeDefined();
    expect(einv.status).toBe("generated");

    const validDays = Math.round((einv.ewayValidUntil!.getTime() - einv.ackDate.getTime()) / 86400000);
    expect(validDays).toBe(3);
  });
});
