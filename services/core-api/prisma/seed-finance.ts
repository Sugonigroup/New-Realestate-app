import type { PrismaClient } from "@prisma/client";

/** Indian RE books for Verde Residences (₹100 Cr GDV). Idempotent. */
export async function seedFinanceBooks(
  prisma: PrismaClient,
  tenantId: string,
  entityId: string,
  projectId: string,
): Promise<void> {
  const cr = (n: number) => BigInt(n) * 1_00_00_000_00n;
  const lakh = (n: number) => BigInt(n) * 1_00_000_00n;

  const accounts: Array<{ code: string; name: string; type: string; parentCode?: string; isPostable: boolean }> = [
    { code: "1000", name: "Assets", type: "asset", isPostable: false },
    { code: "2000", name: "Liabilities", type: "liability", isPostable: false },
    { code: "3000", name: "Equity", type: "equity", isPostable: false },
    { code: "4000", name: "Income", type: "revenue", isPostable: false },
    { code: "5000", name: "Expenses", type: "expense", isPostable: false },
    { code: "1100-BANK-OPS", name: "HDFC Current — operations", type: "asset", parentCode: "1000", isPostable: true },
    { code: "1110-BANK-ESCROW", name: "HDFC RERA escrow — Verde", type: "asset", parentCode: "1000", isPostable: true },
    { code: "1120-CASH", name: "Petty cash", type: "asset", parentCode: "1000", isPostable: true },
    { code: "1200-AR", name: "Customer receivables", type: "asset", parentCode: "1000", isPostable: true },
    { code: "1210-WIP", name: "Construction WIP — Verde", type: "asset", parentCode: "1000", isPostable: true },
    { code: "1220-INV-CEMENT", name: "Inventory — cement", type: "asset", parentCode: "1000", isPostable: true },
    { code: "1230-LAND", name: "Land / JDA deposits", type: "asset", parentCode: "1000", isPostable: true },
    { code: "1300-GST-ITC", name: "GST input credit", type: "asset", parentCode: "1000", isPostable: true },
    { code: "2100-AP", name: "Trade payables", type: "liability", parentCode: "2000", isPostable: true },
    { code: "2110-TDS-PAY", name: "TDS payable 194C", type: "liability", parentCode: "2000", isPostable: true },
    { code: "2120-GST-OUT", name: "Output GST", type: "liability", parentCode: "2000", isPostable: true },
    { code: "2130-CF-LOAN", name: "Construction finance", type: "liability", parentCode: "2000", isPostable: true },
    { code: "2200-ADV-CUST", name: "Customer advances", type: "liability", parentCode: "2000", isPostable: true },
    { code: "2210-RETENTION", name: "Retention payable", type: "liability", parentCode: "2000", isPostable: true },
    { code: "2300-GRIR", name: "GRIR", type: "liability", parentCode: "2000", isPostable: true },
    { code: "3100-EQUITY", name: "Share capital", type: "equity", parentCode: "3000", isPostable: true },
    { code: "3200-RE", name: "Retained earnings", type: "equity", parentCode: "3000", isPostable: true },
    { code: "4100-REV-SALE", name: "Unit sale revenue", type: "revenue", parentCode: "4000", isPostable: true },
    { code: "4110-REV-PLC", name: "PLC / floor rise", type: "revenue", parentCode: "4000", isPostable: true },
    { code: "5100-CEMENT", name: "Cement", type: "expense", parentCode: "5000", isPostable: true },
    { code: "5110-STEEL", name: "Steel / TMT", type: "expense", parentCode: "5000", isPostable: true },
    { code: "5120-LABOUR", name: "Labour contract", type: "expense", parentCode: "5000", isPostable: true },
    { code: "5130-CONSULT", name: "Consultants", type: "expense", parentCode: "5000", isPostable: true },
    { code: "5140-OVERHEAD", name: "Site overhead", type: "expense", parentCode: "5000", isPostable: true },
    { code: "5150-INT", name: "Construction finance interest", type: "expense", parentCode: "5000", isPostable: true },
    { code: "5160-MKT", name: "Sales and marketing", type: "expense", parentCode: "5000", isPostable: true },
  ];
  for (const a of accounts) {
    await prisma.account.upsert({
      where: { tenantId_code: { tenantId, code: a.code } },
      update: { name: a.name, type: a.type, parentCode: a.parentCode, isPostable: a.isPostable },
      create: { tenantId, ...a },
    });
  }

  const fyMonths = [
    "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09",
    "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03",
  ];
  for (const period of fyMonths) {
    const [ys, ms] = period.split("-");
    const y = Number(ys);
    const m = Number(ms);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    await prisma.fiscalPeriod.upsert({
      where: { tenantId_period: { tenantId, period } },
      update: {},
      create: { tenantId, period, start, end, status: "open" },
    });
  }

  const line = (accountCode: string, debit: bigint, credit: bigint, description?: string) => ({
    accountCode, debitPaise: debit, creditPaise: credit, description,
  });

  if (!(await prisma.journal.findFirst({ where: { tenantId, voucherNo: "JV-OPEN-FY27" } }))) {
    await prisma.journal.create({
      data: {
        tenantId, voucherNo: "JV-OPEN-FY27", type: "journal",
        date: new Date("2026-04-01T00:00:00Z"),
        narration: "Opening books FY 2026-27 — Verde Residences (100 Cr GDV)",
        status: "posted", postedAt: new Date("2026-04-01T00:00:00Z"),
        lines: { create: [
          line("1110-BANK-ESCROW", cr(22), 0n, "RERA 70% parked"),
          line("1100-BANK-OPS", cr(3), 0n, "Collection current account"),
          line("1230-LAND", cr(20), 0n, "JDA / land"),
          line("1210-WIP", cr(28), 0n, "Structure WIP to date"),
          line("1200-AR", cr(8), 0n, "Milestone billed unpaid"),
          line("2200-ADV-CUST", 0n, cr(35), "Customer collections"),
          line("2100-AP", 0n, cr(6), "Trade creditors"),
          line("2130-CF-LOAN", 0n, cr(15), "HDFC construction finance"),
          line("3100-EQUITY", 0n, cr(25), "Promoter equity"),
        ] },
      },
    });
  }

  if (!(await prisma.journal.findFirst({ where: { tenantId, voucherNo: "JV-CEMENT-PO0001" } }))) {
    await prisma.journal.create({
      data: {
        tenantId, voucherNo: "JV-CEMENT-PO0001", type: "purchase",
        date: new Date("2026-08-14T00:00:00Z"),
        narration: "Ultratech cement against PO-0001",
        status: "posted", postedAt: new Date("2026-08-14T00:00:00Z"),
        lines: { create: [
          line("5100-CEMENT", 24_500_000_00n, 0n, "OPC 53"),
          line("2100-AP", 0n, 24_500_000_00n, "Ultratech"),
        ] },
      },
    });
  }

  if (!(await prisma.journal.findFirst({ where: { tenantId, voucherNo: "JV-REV-PLINTH" } }))) {
    await prisma.journal.create({
      data: {
        tenantId, voucherNo: "JV-REV-PLINTH", type: "sales",
        date: new Date("2026-06-15T00:00:00Z"),
        narration: "Recognise plinth milestone against customer advances",
        status: "posted", postedAt: new Date("2026-06-15T00:00:00Z"),
        lines: { create: [
          line("2200-ADV-CUST", cr(5), 0n),
          line("4100-REV-SALE", 0n, cr(5)),
        ] },
      },
    });
  }

  if (!(await prisma.journal.findFirst({ where: { tenantId, voucherNo: "JV-2026-08-014" } }))) {
    await prisma.journal.create({
      data: {
        tenantId, voucherNo: "JV-2026-08-014", type: "journal",
        date: new Date("2026-08-20T00:00:00Z"),
        narration: "Accrue site overhead August (draft — awaiting post)",
        status: "draft",
        lines: { create: [
          line("5140-OVERHEAD", lakh(50), 0n, "Site overhead"),
          line("2100-AP", 0n, lakh(50), "Site vendor"),
        ] },
      },
    });
  }

  if (!(await prisma.vendorInvoice.findFirst({ where: { tenantId, invoiceNo: "INV-ULTRATECH-0826" } }))) {
    await prisma.vendorInvoice.create({
      data: {
        tenantId, projectId, vendorId: "ultratech", invoiceNo: "INV-ULTRATECH-0826",
        invoiceDate: new Date("2026-08-14"), amountPaise: 24_500_000_00n,
        tdsBps: 200, status: "3way_matched",
        matchResult: {
          poTotal: "2,45,00,000.00", grnTotal: "2,45,00,000.00", invoiceTotal: "2,45,00,000.00",
          variancePct: 0, grnMatch: true, invoiceMatch: true,
        },
      },
    });
  }

  await prisma.bankAccount.upsert({
    where: { tenantId_accountNo: { tenantId, accountNo: "502000123456" } },
    update: {},
    create: { tenantId, accountNo: "502000123456", bankName: "HDFC Bank", ifsc: "HDFC0001234", isEscrow: false, balancePaise: cr(3) },
  });
  const escrowAcct = await prisma.bankAccount.upsert({
    where: { tenantId_accountNo: { tenantId, accountNo: "502000123457" } },
    update: {},
    create: { tenantId, accountNo: "502000123457", bankName: "HDFC Bank", ifsc: "HDFC0001234", isEscrow: true, balancePaise: cr(22) },
  });

  if ((await prisma.bankTransaction.count({ where: { tenantId } })) === 0) {
    await prisma.bankTransaction.createMany({
      data: [
        { tenantId, bankAccountId: escrowAcct.id, date: new Date("2026-08-18"), amountPaise: cr(1), narration: "NEFT unit T1-101 booking", utr: "HDFC20260818VRD001" },
        { tenantId, bankAccountId: escrowAcct.id, date: new Date("2026-08-21"), amountPaise: -lakh(12), narration: "Bank charges", utr: "CHG-ESC-0821" },
      ],
    });
  }

  const units = await prisma.unit.findMany({ where: { projectId }, orderBy: { code: "asc" }, take: 2 });
  if (units.length < 2) return;

  for (const [i, unit] of units.entries()) {
    const code = i === 0 ? "BK-VRD-101" : "BK-VRD-102";
    let booking = await prisma.booking.findFirst({ where: { tenantId, code } });
    if (!booking) {
      booking = await prisma.booking.create({
        data: {
          tenantId, unitId: unit.id, projectId, code,
          customerName: i === 0 ? "Ravi Menon" : "Anita Desai",
          customerPhone: i === 0 ? "+919811100001" : "+919811100002",
          planCode: "CLP", totalPaise: cr(1) + lakh(25),
          priceSnapshot: { total: "12500000" }, status: "confirmed",
          bookingDate: new Date("2026-03-01"),
        },
      });
      await prisma.unit.update({ where: { id: unit.id }, data: { state: "booked" } });
    }
    const demandNo = i === 0 ? "DMND-000101" : "DMND-000102";
    if (!(await prisma.demand.findFirst({ where: { tenantId, demandNo } }))) {
      await prisma.demand.create({
        data: {
          tenantId, bookingId: booking.id, unitId: unit.id, entityId,
          seq: 3, demandNo, scheduleKey: "slab_3", label: "On 3rd slab",
          amountPaise: i === 0 ? lakh(45) : lakh(80),
          dueDate: i === 0 ? new Date("2026-07-15") : new Date("2026-04-01"),
          status: "overdue",
        },
      });
    }
  }

  const ravi = await prisma.booking.findFirst({ where: { tenantId, code: "BK-VRD-101" } });
  if (ravi && !(await prisma.receipt.findFirst({ where: { tenantId, instrumentRef: "HDFC20260818VRD001" } }))) {
    await prisma.receipt.create({
      data: {
        tenantId, bookingId: ravi.id, unitId: ravi.unitId,
        amountPaise: cr(1), instrument: "neft", instrumentRef: "HDFC20260818VRD001",
        status: "cleared", clearedAt: new Date("2026-08-18"),
      },
    });
  }
}
