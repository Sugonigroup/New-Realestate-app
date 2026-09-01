import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { BudgetingService } from "./budgeting.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    budgets: [] as Row[],
    lines: [] as Row[],
    scenarios: [] as Row[],
    journalLines: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;
  const child = (parentId: string, fk: string, create: any[]) =>
    (create as any[]).map((l) => {
      const lr = { id: nid("ln"), ...l, [fk]: parentId };
      db.lines.push(lr);
      return lr;
    });

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(row[k]);
      if (v && typeof v === "object" && "not" in (v as object)) return row[k] !== (v as { not: unknown }).not;
      return row[k] === v;
    });
  }

  const prisma = {
    enterpriseBudget: {
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let res = db.budgets.filter(match(where));
        if (orderBy?.versionNo === "desc") res.sort((a, b) => (b.versionNo as number) - (a.versionNo as number));
        return res.map((b) => ({ ...b, lines: db.lines.filter((x) => x.budgetId === b.id) }));
      }),
      findFirst: vi.fn(async ({ where, include }: any) => {
        const b = db.budgets.find(match(where));
        if (!b) return null;
        const res = { ...b };
        if (include?.lines) res.lines = db.lines.filter((x) => x.budgetId === b.id);
        return res;
      }),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("bgt"), status: "draft", ...data };
        if (data.lines?.create) r.lines = child(r.id, "budgetId", data.lines.create);
        db.budgets.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.budgets.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let n = 0;
        for (const b of db.budgets) {
          if (b.tenantId === where.tenantId && b.fiscalYear === where.fiscalYear && b.status === where.status && b.id !== where.id?.not) {
            Object.assign(b, data);
            n += 1;
          }
        }
        return { count: n };
      }),
    },
    forecastScenario: {
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("scn"), ...data };
        db.scenarios.push(r);
        return r;
      }),
    },
    journalLine: {
      findMany: vi.fn(async ({ where }: any) => db.journalLines.filter((jl) => {
        const codeOk = (where.accountCode.in as string[]).includes(jl.accountCode as string);
        const jOk = jl.journal && (jl.journal as Row).tenantId === where.journal.tenantId && (jl.journal as Row).status === where.journal.status;
        return codeOk && jOk;
      })),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("BudgetingService", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: BudgetingService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new BudgetingService(f.prisma as never);
  });

  it("creates a draft budget with auto-incremented version number per fiscal year", async () => {
    const b1 = await svc.createBudget(T, {
      fiscalYear: "FY2026-27", title: "Original Operating Plan",
      lines: [{ costCenter: "CC-EXEC", accountCode: "5000-EXP", period: "2026-09", amountPaise: 10_00_000n }],
    });
    expect(b1.versionNo).toBe(1);
    expect(b1.status).toBe("draft");
    expect(b1.totalPaise).toBe(10_00_000n);

    const b2 = await svc.createBudget(T, {
      fiscalYear: "FY2026-27", title: "Revised Operating Plan",
      lines: [{ costCenter: "CC-EXEC", accountCode: "5000-EXP", period: "2026-09", amountPaise: 12_00_000n }],
    });
    expect(b2.versionNo).toBe(2);
  });

  it("approving a budget marks previous approved versions for the FY as superseded", async () => {
    f.db.budgets.push({ id: "b-1", tenantId: T, fiscalYear: "FY2026-27", versionNo: 1, status: "approved" });
    f.db.budgets.push({ id: "b-2", tenantId: T, fiscalYear: "FY2026-27", versionNo: 2, status: "draft" });

    const app = await svc.approveBudget(T, "b-2", "user-cfo");
    expect(app.status).toBe("approved");
    expect(f.db.budgets.find((x) => x.id === "b-1")!.status).toBe("superseded");
  });

  it("locks an approved budget and prevents locking unapproved ones", async () => {
    f.db.budgets.push({ id: "b-draft", tenantId: T, fiscalYear: "FY2026-27", versionNo: 1, status: "draft" });
    await expect(svc.lockBudget(T, "b-draft")).rejects.toThrow(ConflictException);

    f.db.budgets.push({ id: "b-app", tenantId: T, fiscalYear: "FY2026-27", versionNo: 2, status: "approved" });
    const locked = await svc.lockBudget(T, "b-app");
    expect(locked.status).toBe("locked");
  });

  it("models what-if scenario with growth and inflation basis points", async () => {
    const b = await svc.createBudget(T, {
      fiscalYear: "FY2026-27", title: "Base Plan",
      lines: [
        { costCenter: "CC-SITE", accountCode: "5000-LABOR", period: "2026-09", amountPaise: 1_00_00_000n }, // ₹1L
      ],
    });

    // 10% growth (+1000 bps) + 5% inflation (+500 bps) = +15% multiplier (11500 bps)
    const scn = await svc.createScenario(T, {
      budgetId: b.id, name: "Expansion Scenario",
      growthBps: 1000, inflationBps: 500,
    });

    expect(scn.projectedTotalPaise).toBe(1_15_00_000n); // ₹1.15L
    expect(scn.variancePaise).toBe(15_00_000n);
  });

  it("generates variance report against GL actuals with threshold alerts (GREEN <10%, AMBER >=10%, RED >=20%)", async () => {
    const b = await svc.createBudget(T, {
      fiscalYear: "FY2026-27", title: "Base Plan",
      lines: [
        { costCenter: "CC-SITE", accountCode: "5000-MAT", period: "2026-09", amountPaise: 10_00_000n }, // ₹10,000 budget
        { costCenter: "CC-SITE", accountCode: "5000-LAB", period: "2026-09", amountPaise: 10_00_000n }, // ₹10,000 budget
        { costCenter: "CC-EXEC", accountCode: "5000-OFF", period: "2026-09", amountPaise: 10_00_000n }, // ₹10,000 budget
      ],
    });

    // Actual GL posted debits:
    // MAT: 10_50_000 (+5% → GREEN)
    // LAB: 11_20_000 (+12% → AMBER)
    // OFF: 12_50_000 (+25% → RED)
    f.db.journalLines.push(
      { id: "jl-1", accountCode: "5000-MAT", debitPaise: 10_50_000n, journal: { tenantId: T, status: "posted" } },
      { id: "jl-2", accountCode: "5000-LAB", debitPaise: 11_20_000n, journal: { tenantId: T, status: "posted" } },
      { id: "jl-3", accountCode: "5000-OFF", debitPaise: 12_50_000n, journal: { tenantId: T, status: "posted" } },
    );

    const report = await svc.varianceReport(T, b.id, "2026-09");
    expect(report.totalBudgetPaise).toBe(30_00_000n);
    expect(report.totalActualPaise).toBe(34_20_000n);
    expect(report.overallVariancePct).toBe(14); // +14% overall → AMBER
    expect(report.overallAlert).toBe("AMBER");

    const mat = report.items.find((i) => i.accountCode === "5000-MAT")!;
    expect(mat.alert).toBe("GREEN");

    const lab = report.items.find((i) => i.accountCode === "5000-LAB")!;
    expect(lab.alert).toBe("AMBER");

    const off = report.items.find((i) => i.accountCode === "5000-OFF")!;
    expect(off.alert).toBe("RED");
  });

  it("lists budgets with line items", async () => {
    await svc.createBudget(T, {
      fiscalYear: "FY27", title: "Ops",
      lines: [{ costCenter: "CC-1", accountCode: "5000", period: "2026-09", amountPaise: 100n }],
    });
    const rows = await svc.listBudgets(T) as Array<{ title: string; lines: unknown[] }>;
    expect(rows[0]!.title).toBe("Ops");
    expect(rows[0]!.lines).toHaveLength(1);
  });
});
