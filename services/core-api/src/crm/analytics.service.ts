import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CRM Analytics (CRM-078..085):
 * - Funnel: lead status distribution with stage conversion rates
 * - Source analytics: per-source leads → qualified → won, conversion %
 * - Rep analytics: per-assigned-user leads, won value, response-time SLA compliance
 */

const FUNNEL_ORDER = [
  "new", "contacted", "qualified", "visit_scheduled", "visited", "negotiation", "booking", "won",
];

@Injectable()
export class CrmAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async funnel(tenantId: string, projectId?: string) {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, projectId: projectId ?? undefined },
    });
    const byStatus = new Map<string, number>();
    for (const l of leads) byStatus.set(l.status as string, (byStatus.get(l.status as string) ?? 0) + 1);

    // Cumulative reach per funnel stage (a lead at "visited" has passed contacted/qualified)
    const rank = new Map(FUNNEL_ORDER.map((s, i) => [s, i]));
    const cumulative = FUNNEL_ORDER.map((stage) => {
      const minRank = rank.get(stage)!;
      return leads.filter((l) => (rank.get(l.status as string) ?? -1) >= minRank).length;
    });

    const stages = FUNNEL_ORDER.map((stage, i) => {
      const reached = cumulative[i]!;
      const prev = i > 0 ? cumulative[i - 1]! : reached;
      return {
        stage,
        reached,
        conversionFromPrevPct: i === 0 || prev === 0 ? null : Math.round((reached / prev) * 100),
      };
    });

    const total = leads.length;
    const won = byStatus.get("won") ?? 0;
    return { totalLeads: total, wonCount: won, winPct: total > 0 ? Math.round((won / total) * 100) : 0, stages };
  }

  async sourceAnalytics(tenantId: string) {
    const leads = await this.prisma.lead.findMany({ where: { tenantId } });
    const opps = await this.prisma.opportunity.findMany({ where: { tenantId, stage: "won" } });
    const wonLeadIds = new Set(opps.map((o) => o.leadId));

    const bySource = new Map<string, { leads: number; qualified: number; won: number }>();
    for (const l of leads) {
      const key = l.source as string;
      let bucket = bySource.get(key);
      if (!bucket) {
        bucket = { leads: 0, qualified: 0, won: 0 };
        bySource.set(key, bucket);
      }
      bucket.leads += 1;
      if (["qualified", "visit_scheduled", "visited", "negotiation", "booking", "won"].includes(l.status as string)) {
        bucket.qualified += 1;
      }
      if (wonLeadIds.has(l.id as string)) bucket.won += 1;
    }

    return [...bySource.entries()]
      .map(([source, b]) => ({
        source,
        leads: b.leads,
        qualified: b.qualified,
        won: b.won,
        leadToWonPct: b.leads > 0 ? Math.round((b.won / b.leads) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.won - a.won || b.leads - a.leads);
  }

  async repAnalytics(tenantId: string) {
    const leads = await this.prisma.lead.findMany({ where: { tenantId } });
    const opps = await this.prisma.opportunity.findMany({ where: { tenantId } });
    const wonByRep = new Map<string, bigint>();
    for (const o of opps.filter((o) => o.stage === "won" && o.assignedUserId)) {
      wonByRep.set(o.assignedUserId as string, (wonByRep.get(o.assignedUserId as string) ?? 0n) + o.expectedValuePaise);
    }

    const byRep = new Map<string, { leads: number; responded: number; slaOk: number }>();
    for (const l of leads) {
      if (!l.assignedUserId) continue;
      const key = l.assignedUserId as string;
      let bucket = byRep.get(key);
      if (!bucket) {
        bucket = { leads: 0, responded: 0, slaOk: 0 };
        byRep.set(key, bucket);
      }
      bucket.leads += 1;
      if (l.firstRespondedAt) {
        bucket.responded += 1;
        if (!l.slaRespondBy || l.firstRespondedAt <= l.slaRespondBy) bucket.slaOk += 1;
      }
    }

    return [...byRep.entries()].map(([userId, b]) => ({
      userId,
      leads: b.leads,
      responded: b.responded,
      slaCompliancePct: b.responded > 0 ? Math.round((b.slaOk / b.responded) * 100) : null,
      wonValuePaise: wonByRep.get(userId) ?? 0n,
    }));
  }
}
