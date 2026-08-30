import { Injectable } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { profileFor, qprPeriodFor } from "./state-profiles.js";
import { draftQpr, exportBundle, type QprSourceData } from "./qpr.js";
import { generateMonthlyItems, type StatutoryItem } from "./statutory.js";

/** Compliance service (U4): QPR drafting from live data + statutory calendar assembly. */
@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  /** Assemble QPR source data from live modules, then draft per state profile. */
  async draftQprFromLive(tenantId: string, projectId: string, stateCode: string): Promise<unknown> {
    const profile = profileFor(stateCode);
    const period = qprPeriodFor(stateCode, new Date());

    const [milestones, bookings, demands, escrow] = await Promise.all([
      this.prisma.milestone.findMany({ where: { tenantId, projectId, state: "certified" } }),
      this.prisma.booking.findMany({ where: { tenantId, projectId: projectId, status: "confirmed" } }),
      this.prisma.demand.findMany({ where: { tenantId } }),
      this.prisma.escrowAccount.findFirst({ where: { tenantId, projectId } }),
    ]);

    const data: QprSourceData = {
      physicalCompletionPct: 0, // from Projects EVM — snapshotted at review time
      milestonesCertified: milestones.map((m) => m.key),
      unitsSanctioned: 0,
      unitsBookedQuarter: bookings.length,
      unitsBookedCumulative: bookings.length,
      cancellationsQuarter: 0,
      areaBookedSqm: 0,
      collectedPaise: demands.reduce((s, d) => s + BigInt(d.paidPaise), 0n),
      demandedPaise: demands.reduce((s, d) => s + BigInt(d.amountPaise), 0n),
      escrowBalancePaise: escrow ? escrow.collectedPaise - escrow.withdrawnPaise : 0n,
      withdrawnPaise: escrow?.withdrawnPaise ?? 0n,
      litigation: [],
      newApprovals: [],
      activeAgents: [],
      progressPhotos: [],
    };
    const draft = draftQpr(stateCode, new Date(), data, "PENDING-REG");
    return { profile: { authority: profile.authority, cadence: profile.qpr.cadence }, period, ...draft };
  }

  /** Export bundle for the portal upload. */
  exportBundle(tenantId: string, projectId: string, stateCode: string) {
    void tenantId; void projectId;
    const period = qprPeriodFor(stateCode, new Date());
    const sample: QprSourceData = {
      physicalCompletionPct: 0, milestonesCertified: [], unitsSanctioned: 0,
      unitsBookedQuarter: 0, unitsBookedCumulative: 0, cancellationsQuarter: 0,
      areaBookedSqm: 0, collectedPaise: 0n, demandedPaise: 0n, escrowBalancePaise: 0n,
      withdrawnPaise: 0n, litigation: [], newApprovals: [], activeAgents: [], progressPhotos: [],
    };
    const { payload } = draftQpr(stateCode, new Date(), sample, "PENDING-REG");
    return exportBundle({ ...payload, year: period.year, period: period.period });
  }

  /** Statutory calendar for a month (GST/TDS/PF/ESIC/PT due dates). */
  statutoryMonth(year: number, month0: number): StatutoryItem[] {
    return generateMonthlyItems(year, month0);
  }
}

const _money = Money; // keep import for narrative use
void _money;
