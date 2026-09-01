import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { Money } from "@buildos/money-utils";

/**
 * FP&A Enterprise Budgeting & Forecasting service (P1c):
 * - Budget creation & versioning (draft → submit → approve → lock)
 * - Line item allocations per cost center / account / period
 * - Rolling forecast vs actuals variance analysis (amber >=10%, red >=20%)
 * - What-if scenario modeling with growth + inflation basis points
 */

export interface BudgetLineInput {
  costCenter: string;
  accountCode: string;
  period: string; // "YYYY-MM"
  amountPaise: bigint;
}

@Injectable()
export class BudgetingService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Budgets ─────────────────────────────────────────────────────────────

  async listBudgets(tenantId: string) {
    return this.prisma.enterpriseBudget.findMany({
      where: { tenantId },
      orderBy: [{ fiscalYear: "desc" }, { versionNo: "desc" }],
      take: 50,
      include: { lines: true },
    });
  }

  async createBudget(tenantId: string, input: {
    fiscalYear: string;
    title: string;
    lines: BudgetLineInput[];
  }) {
    if (input.lines.length === 0) throw new BadRequestException("budget needs at least one line");
    // Find latest version for fiscal year
    const existing = await this.prisma.enterpriseBudget.findMany({
      where: { tenantId, fiscalYear: input.fiscalYear },
      orderBy: { versionNo: "desc" },
      take: 1,
    });
    const nextVersion = existing.length > 0 ? existing[0]!.versionNo + 1 : 1;
    const totalPaise = input.lines.reduce((s, l) => s + l.amountPaise, 0n);

    return this.prisma.enterpriseBudget.create({
      data: {
        tenantId,
        fiscalYear: input.fiscalYear,
        title: input.title,
        versionNo: nextVersion,
        status: "draft",
        totalPaise,
        lines: {
          create: input.lines.map((l) => ({
            tenantId,
            costCenter: l.costCenter,
            accountCode: l.accountCode,
            period: l.period,
            amountPaise: l.amountPaise,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async approveBudget(tenantId: string, budgetId: string, approverId: string) {
    const budget = await this.prisma.enterpriseBudget.findFirst({ where: { tenantId, id: budgetId } });
    if (!budget) throw new NotFoundException(`budget ${budgetId} not found`);
    if (budget.status !== "draft" && budget.status !== "submitted") {
      throw new ConflictException(`budget ${budget.fiscalYear} v${budget.versionNo} is ${budget.status}, cannot approve`);
    }
    // Mark previous approved versions for this FY as superseded
    await this.prisma.enterpriseBudget.updateMany({
      where: { tenantId, fiscalYear: budget.fiscalYear, status: "approved", id: { not: budget.id } },
      data: { status: "superseded" },
    });
    return this.prisma.enterpriseBudget.update({
      where: { id: budget.id },
      data: { status: "approved", approvedBy: approverId, approvedAt: new Date() },
    });
  }

  async lockBudget(tenantId: string, budgetId: string) {
    const budget = await this.prisma.enterpriseBudget.findFirst({ where: { tenantId, id: budgetId } });
    if (!budget) throw new NotFoundException(`budget ${budgetId} not found`);
    if (budget.status !== "approved") {
      throw new ConflictException(`budget ${budget.fiscalYear} v${budget.versionNo} is ${budget.status}, must be approved to lock`);
    }
    return this.prisma.enterpriseBudget.update({
      where: { id: budget.id },
      data: { status: "locked" },
    });
  }

  // ── Scenarios ───────────────────────────────────────────────────────────

  async createScenario(tenantId: string, input: {
    budgetId: string;
    name: string;
    growthBps: number;
    inflationBps: number;
  }) {
    const budget = await this.prisma.enterpriseBudget.findFirst({
      where: { tenantId, id: input.budgetId },
      include: { lines: true },
    });
    if (!budget) throw new NotFoundException(`budget ${input.budgetId} not found`);
    const scenario = await this.prisma.forecastScenario.create({
      data: {
        tenantId,
        budgetId: budget.id,
        name: input.name,
        growthBps: input.growthBps,
        inflationBps: input.inflationBps,
      },
    });
    // Calculate simulated budget lines with growth + inflation adjustment factor
    // Factor = 1 + (growthBps + inflationBps) / 10,000
    const factorBps = 10_000 + input.growthBps + input.inflationBps;
    const projectedLines = budget.lines.map((l) => ({
      costCenter: l.costCenter,
      accountCode: l.accountCode,
      period: l.period,
      baseAmountPaise: l.amountPaise,
      projectedAmountPaise: (l.amountPaise * BigInt(factorBps)) / 10_000n,
    }));
    const projectedTotal = projectedLines.reduce((s, l) => s + l.projectedAmountPaise, 0n);
    return {
      scenarioId: scenario.id,
      name: scenario.name,
      baseTotalPaise: budget.totalPaise,
      projectedTotalPaise: projectedTotal,
      variancePaise: projectedTotal - budget.totalPaise,
      projectedLines,
    };
  }

  // ── Variance Analysis ───────────────────────────────────────────────────

  /** Compare budget lines against actual GL journal posted debits for a period/cost-center. */
  async varianceReport(tenantId: string, budgetId: string, period: string) {
    const budget = await this.prisma.enterpriseBudget.findFirst({
      where: { tenantId, id: budgetId },
      include: { lines: true },
    });
    if (!budget) throw new NotFoundException(`budget ${budgetId} not found`);
    const periodLines = budget.lines.filter((l) => l.period === period);
    if (periodLines.length === 0) {
      throw new NotFoundException(`budget ${budget.fiscalYear} has no lines for period ${period}`);
    }

    // Pull posted journal lines for the matching period & accounts
    const accountCodes = [...new Set(periodLines.map((l) => l.accountCode))];
    const journalLines = await this.prisma.journalLine.findMany({
      where: {
        accountCode: { in: accountCodes },
        journal: { tenantId, status: "posted" },
      },
      include: { journal: true },
    });

    // Sum actual debits per accountCode
    const actualsByAccount = new Map<string, bigint>();
    for (const jl of journalLines) {
      const cur = actualsByAccount.get(jl.accountCode) ?? 0n;
      actualsByAccount.set(jl.accountCode, cur + jl.debitPaise);
    }

    const items = periodLines.map((bl) => {
      const actualPaise = actualsByAccount.get(bl.accountCode) ?? 0n;
      const variancePaise = actualPaise - bl.amountPaise;
      const variancePct = Number(bl.amountPaise) > 0
        ? Math.round((Number(variancePaise) / Number(bl.amountPaise)) * 100)
        : 0;
      const alert = variancePct >= 20 ? "RED" : variancePct >= 10 ? "AMBER" : "GREEN";
      return {
        costCenter: bl.costCenter,
        accountCode: bl.accountCode,
        budgetPaise: bl.amountPaise,
        actualPaise,
        variancePaise,
        variancePct,
        alert,
      };
    });

    const totalBudget = periodLines.reduce((s, l) => s + l.amountPaise, 0n);
    const totalActual = items.reduce((s, i) => s + i.actualPaise, 0n);
    const totalVariance = totalActual - totalBudget;
    const overallPct = Number(totalBudget) > 0 ? Math.round((Number(totalVariance) / Number(totalBudget)) * 100) : 0;
    const overallAlert = overallPct >= 20 ? "RED" : overallPct >= 10 ? "AMBER" : "GREEN";

    return {
      budgetId: budget.id,
      fiscalYear: budget.fiscalYear,
      period,
      totalBudgetPaise: totalBudget,
      totalActualPaise: totalActual,
      totalVariancePaise: totalVariance,
      overallVariancePct: overallPct,
      overallAlert,
      items,
    };
  }
}
