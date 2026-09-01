import { Injectable } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { attribute, efficiency, type AttributionModel, type Touch, type BookingResult } from "./attribution.js";

/** Marketing service (Phase 5, 01 §M4): campaign management + closed-loop attribution. */
@Injectable()
export class MarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async listCampaigns(tenantId: string) {
    return this.prisma.campaign.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async createCampaign(tenantId: string, input: { name: string; channel: string; projectId?: string }): Promise<unknown> {
    return this.prisma.campaign.create({ data: { tenantId, ...input } });
  }

  async recordSpend(tenantId: string, campaignId: string, date: Date, spendPaise: bigint, leads: number): Promise<unknown> {
    const row = await this.prisma.campaignSpend.create({
      data: { tenantId, campaignId, date, spendPaise, leads },
    });
    const campaign = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (campaign) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { spendPaise: campaign.spendPaise + spendPaise },
      });
    }
    return row;
  }

  /** Closed-loop attribution from leads (touches) and bookings (results). */
  async campaignRoi(tenantId: string, projectId: string | undefined, model: AttributionModel): Promise<unknown> {
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId, ...(projectId ? { projectId } : {}) },
    });
    const campaignIds = new Set(campaigns.map((c) => c.id));

    const leads = await this.prisma.lead.findMany({
      where: { tenantId, ...(projectId ? { projectId } : {}), campaignId: { not: null } },
      select: { id: true, campaignId: true, createdAt: true, source: true },
    });
    const touches: Touch[] = leads
      .filter((l) => l.campaignId && campaignIds.has(l.campaignId))
      .map((l) => ({ leadId: l.id, ts: l.createdAt, channel: l.source, campaignId: l.campaignId! }));

    const bookings = await this.prisma.booking.findMany({
      where: { tenantId, status: "confirmed", ...(projectId ? { projectId } : {}) },
      select: { id: true, leadId: true, totalPaise: true, bookingDate: true },
    });
    const results: BookingResult[] = bookings
      .filter((b) => b.leadId)
      .map((b) => ({ leadId: b.leadId!, valuePaise: b.totalPaise, bookedAt: b.bookingDate ?? new Date() }));

    const attributed = attribute(touches, results, model);
    const spendBy = new Map<string, { spendPaise: bigint; leads: number }>();
    for (const c of campaigns) {
      const spends = await this.prisma.campaignSpend.findMany({ where: { tenantId, campaignId: c.id } });
      const total = spends.reduce((s, sp) => s + sp.spendPaise, 0n);
      const leadCount = leads.filter((l) => l.campaignId === c.id).length;
      spendBy.set(c.id, { spendPaise: total, leads: leadCount });
    }
    const spendRows = campaigns.map((c) => ({
      campaignId: c.id,
      spendPaise: spendBy.get(c.id)?.spendPaise ?? 0n,
      leads: spendBy.get(c.id)?.leads ?? 0,
    }));
    return { attributed, efficiency: efficiency(spendRows, attributed) };
  }
}
