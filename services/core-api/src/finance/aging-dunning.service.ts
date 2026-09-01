import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Accounts Receivable Aging & Dunning service (FIN-02):
 * - 30/60/90+ day aging bucket calculation across all active customer demand milestones
 * - Automated dunning level classification (Level 1: Notice, Level 2: Warning, Level 3: Legal)
 * - Overdue interest calculation at configured annual rate (e.g. 18% p.a. per RERA guidelines)
 */

@Injectable()
export class AgingDunningService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateArAging(tenantId: string, asOfDate: Date = new Date()) {
    const demands = await this.prisma.demand.findMany({
      where: { tenantId, status: { in: ["issued", "due", "reminded", "part_paid", "overdue"] } },
    });

    let currentPaise = 0n;
    let b30to60Paise = 0n;
    let b60to90Paise = 0n;
    let b90PlusPaise = 0n;

    for (const d of demands) {
      if (!d.dueDate) continue;
      const due = new Date(d.dueDate);
      const daysOverdue = Math.floor((asOfDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      const amount = d.amountPaise;

      if (daysOverdue <= 30) {
        currentPaise += amount;
      } else if (daysOverdue <= 60) {
        b30to60Paise += amount;
      } else if (daysOverdue <= 90) {
        b60to90Paise += amount;
      } else {
        b90PlusPaise += amount;
      }
    }

    const totalOutstandingPaise = currentPaise + b30to60Paise + b60to90Paise + b90PlusPaise;

    return {
      asOfDate,
      totalOutstandingPaise,
      buckets: {
        currentPaise,      // 0-30 days
        b30to60Paise,      // 31-60 days
        b60to90Paise,      // 61-90 days
        b90PlusPaise,      // >90 days
      },
      dunningSummary: {
        level1NoticeCount: demands.filter((d) => {
          if (!d.dueDate) return false;
          const days = Math.floor((asOfDate.getTime() - new Date(d.dueDate).getTime()) / (86400000));
          return days > 30 && days <= 60;
        }).length,
        level2WarningCount: demands.filter((d) => {
          if (!d.dueDate) return false;
          const days = Math.floor((asOfDate.getTime() - new Date(d.dueDate).getTime()) / (86400000));
          return days > 60 && days <= 90;
        }).length,
        level3LegalCount: demands.filter((d) => {
          if (!d.dueDate) return false;
          const days = Math.floor((asOfDate.getTime() - new Date(d.dueDate).getTime()) / (86400000));
          return days > 90;
        }).length,
      },
    };
  }

  /** Calculate RERA-compliant interest on overdue customer demand (e.g. 18% p.a.). */
  async calculateOverdueInterest(principalPaise: bigint, dueDate: Date, asOfDate: Date = new Date(), annualRateBps: number = 1800) {
    const daysOverdue = Math.max(0, Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
    if (daysOverdue === 0) return { daysOverdue: 0, interestPaise: 0n, totalWithInterestPaise: principalPaise };

    // Interest = Principal * (annualRateBps / 10000) * (daysOverdue / 365)
    const rateFactorBps = BigInt(annualRateBps);
    const interestPaise = (principalPaise * rateFactorBps * BigInt(daysOverdue)) / (10_000n * 365n);

    return {
      daysOverdue,
      annualRatePct: annualRateBps / 100,
      interestPaise,
      totalWithInterestPaise: principalPaise + interestPaise,
    };
  }
}
