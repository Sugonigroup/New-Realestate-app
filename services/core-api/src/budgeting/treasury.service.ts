import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Treasury & Debt service (FPA-02):
 * - Debt facility lifecycle: sanctioned → drawdown → repayment → closed
 * - Drawdown capped at sanctioned limit; repayment capped at outstanding principal
 * - Monthly reducing-balance interest forecast schedule
 * - Cash runway & burn rate from forecast snapshots
 */

@Injectable()
export class TreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  async createFacility(tenantId: string, input: {
    facilityNo: string;
    lenderName: string;
    facilityType: "term_loan" | "construction_finance" | "cc_od" | "lap";
    sanctionedPaise: bigint;
    annualRateBps: number;
    tenureMonths: number;
    securedAgainst?: string;
  }) {
    if (input.sanctionedPaise <= 0n) throw new BadRequestException("sanctioned amount must be > 0");
    if (input.annualRateBps <= 0) throw new BadRequestException("annual rate must be > 0");
    const existing = await this.prisma.debtFacility.findFirst({ where: { tenantId, facilityNo: input.facilityNo } });
    if (existing) throw new ConflictException(`facility ${input.facilityNo} already exists`);

    return this.prisma.debtFacility.create({
      data: {
        tenantId,
        facilityNo: input.facilityNo,
        lenderName: input.lenderName,
        facilityType: input.facilityType,
        sanctionedPaise: input.sanctionedPaise,
        annualRateBps: input.annualRateBps,
        tenureMonths: input.tenureMonths,
        securedAgainst: input.securedAgainst,
        status: "active",
      },
    });
  }

  async drawdown(tenantId: string, facilityNo: string, amountPaise: bigint, txnDate: Date = new Date()) {
    if (amountPaise <= 0n) throw new BadRequestException("drawdown amount must be > 0");
    const facility = await this.prisma.debtFacility.findFirst({ where: { tenantId, facilityNo } });
    if (!facility) throw new NotFoundException(`facility ${facilityNo} not found`);
    if (facility.status !== "active") throw new ConflictException(`facility ${facilityNo} is ${facility.status}`);

    const newDrawn = facility.drawnPaise + amountPaise;
    if (newDrawn > facility.sanctionedPaise) {
      throw new BadRequestException(
        `drawdown exceeds sanctioned limit: drawn ₹${newDrawn} > sanctioned ₹${facility.sanctionedPaise}`,
      );
    }

    await this.prisma.debtFacility.update({
      where: { id: facility.id },
      data: { drawnPaise: newDrawn },
    });
    return this.prisma.debtTransaction.create({
      data: { tenantId, facilityId: facility.id, txnType: "drawdown", amountPaise, txnDate },
    });
  }

  async repay(tenantId: string, facilityNo: string, amountPaise: bigint, txnDate: Date = new Date()) {
    if (amountPaise <= 0n) throw new BadRequestException("repayment amount must be > 0");
    const facility = await this.prisma.debtFacility.findFirst({ where: { tenantId, facilityNo } });
    if (!facility) throw new NotFoundException(`facility ${facilityNo} not found`);

    const outstanding = facility.drawnPaise - facility.repaidPaise;
    if (amountPaise > outstanding) {
      throw new BadRequestException(`repayment exceeds outstanding: ₹${amountPaise} > ₹${outstanding}`);
    }

    const newRepaid = facility.repaidPaise + amountPaise;
    const closed = newRepaid === facility.drawnPaise;

    await this.prisma.debtFacility.update({
      where: { id: facility.id },
      data: { repaidPaise: newRepaid, status: closed ? "closed" : "active" },
    });
    return this.prisma.debtTransaction.create({
      data: { tenantId, facilityId: facility.id, txnType: "repayment", amountPaise, txnDate },
    });
  }

  /** Monthly reducing-balance interest forecast on outstanding principal. */
  async interestForecast(tenantId: string, facilityNo: string) {
    const facility = await this.prisma.debtFacility.findFirst({ where: { tenantId, facilityNo } });
    if (!facility) throw new NotFoundException(`facility ${facilityNo} not found`);

    const outstanding = facility.drawnPaise - facility.repaidPaise;
    const schedule: Array<{ month: number; openingPaise: bigint; interestPaise: bigint; closingPaise: bigint }> = [];
    let balance = outstanding;
    let totalInterest = 0n;

    for (let month = 1; month <= facility.tenureMonths && balance > 0n; month++) {
      // Monthly interest = balance * (annualRateBps / 10000) / 12
      const interestPaise = (balance * BigInt(facility.annualRateBps)) / (10_000n * 12n);
      totalInterest += interestPaise;
      schedule.push({
        month,
        openingPaise: balance,
        interestPaise,
        closingPaise: balance,
      });
    }

    return {
      facilityNo: facility.facilityNo,
      lenderName: facility.lenderName,
      outstandingPaise: outstanding,
      annualRatePct: facility.annualRateBps / 100,
      monthlyInterestPaise: schedule[0]?.interestPaise ?? 0n,
      totalInterestFirstYearPaise: schedule.slice(0, 12).reduce((s, r) => s + r.interestPaise, 0n),
      schedule,
    };
  }

  /** Portfolio treasury position: total drawn, outstanding, monthly interest burn, and per-facility breakdown. */
  async portfolioPosition(tenantId: string) {
    const facilities = await this.prisma.debtFacility.findMany({ where: { tenantId, status: "active" } });
    let totalSanctioned = 0n;
    let totalDrawn = 0n;
    let totalOutstanding = 0n;
    let monthlyInterestPaise = 0n;

    for (const f of facilities) {
      totalSanctioned += f.sanctionedPaise;
      totalDrawn += f.drawnPaise;
      const outstanding = f.drawnPaise - f.repaidPaise;
      totalOutstanding += outstanding;
      monthlyInterestPaise += (outstanding * BigInt(f.annualRateBps)) / (10_000n * 12n);
    }

    return {
      activeFacilities: facilities.length,
      totalSanctionedPaise: totalSanctioned,
      totalDrawnPaise: totalDrawn,
      totalOutstandingPaise: totalOutstanding,
      monthlyInterestPaise,
      annualInterestPaise: monthlyInterestPaise * 12n,
      facilities: facilities.map((f) => ({
        facilityNo: f.facilityNo,
        lenderName: f.lenderName,
        facilityType: f.facilityType,
        outstandingPaise: f.drawnPaise - f.repaidPaise,
      })),
    };
  }

  /** Cash runway: months until cash exhausted at current burn rate. */
  async cashRunway(tenantId: string, period: string, openingPaise: bigint, inflowPaise: bigint, outflowPaise: bigint) {
    const netFlow = inflowPaise - outflowPaise;
    const closingPaise = openingPaise + netFlow;
    const burnRatePaise = netFlow < 0n ? -netFlow : 0n;
    const runwayMonths = burnRatePaise > 0n ? Number(closingPaise) / Number(burnRatePaise) : null;

    const snapshot = await this.prisma.cashForecastSnapshot.upsert({
      where: { tenantId_period: { tenantId, period } },
      create: {
        tenantId,
        period,
        openingPaise,
        inflowPaise,
        outflowPaise,
        closingPaise,
        burnRatePaise,
        runwayMonths,
      },
      update: {
        openingPaise,
        inflowPaise,
        outflowPaise,
        closingPaise,
        burnRatePaise,
        runwayMonths,
      },
    });
    return snapshot;
  }
}
