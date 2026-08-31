import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CRM Opportunity pipeline service (CRM-030..044, RECRM-007/008, CRM-095):
 * - Stage flow: prospect → qualification → unit_interest → site_visit → offer → hold
 *   → booking_pending → won (or lost with mandatory reason)
 * - Unit interest lines with live unit-state validation (available units only)
 * - Booking handoff: hold/booking_pending stage + bookingId → won, attribution continuity
 * - Lead assignment with full reassignment history (CRM-008/011)
 * - Site visit lifecycle: scheduled → confirmed → done/no_show with outcome + feedback
 */

const STAGE_ORDER = [
  "prospect", "qualification", "unit_interest", "site_visit", "offer", "hold", "booking_pending",
] as const;

const STAGE_PROBABILITY: Record<string, number> = {
  prospect: 10, qualification: 25, unit_interest: 40, site_visit: 55,
  offer: 70, hold: 85, booking_pending: 95, won: 100, lost: 0,
};

@Injectable()
export class CrmPipelineService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Opportunities ───────────────────────────────────────────────────────

  async createOpportunity(tenantId: string, input: {
    oppNo: string;
    leadId: string;
    projectId: string;
    budgetPaise?: bigint;
    financing?: "cash" | "loan" | "pre_approved";
    expectedValuePaise?: bigint;
    assignedUserId?: string;
  }) {
    const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: input.leadId } });
    if (!lead) throw new NotFoundException(`lead ${input.leadId} not found`);
    if (["lost", "won", "disqualified"].includes(lead.status)) {
      throw new ConflictException(`lead is ${lead.status}; cannot create opportunity`);
    }
    const existing = await this.prisma.opportunity.findFirst({ where: { tenantId, oppNo: input.oppNo } });
    if (existing) throw new ConflictException(`opportunity ${input.oppNo} already exists`);

    return this.prisma.opportunity.create({
      data: {
        tenantId,
        oppNo: input.oppNo,
        leadId: input.leadId,
        projectId: input.projectId,
        budgetPaise: input.budgetPaise ?? lead.budgetPaise,
        financing: input.financing ?? "loan",
        expectedValuePaise: input.expectedValuePaise ?? input.budgetPaise ?? lead.budgetPaise ?? 0n,
        assignedUserId: input.assignedUserId ?? lead.assignedUserId,
        stage: "prospect",
        probabilityPct: STAGE_PROBABILITY["prospect"]!,
      },
    });
  }

  async moveStage(tenantId: string, oppNo: string, to: (typeof STAGE_ORDER)[number]) {
    const opp = await this.prisma.opportunity.findFirst({ where: { tenantId, oppNo } });
    if (!opp) throw new NotFoundException(`opportunity ${oppNo} not found`);
    if (opp.stage === "won" || opp.stage === "lost") {
      throw new ConflictException(`opportunity ${oppNo} is already ${opp.stage}`);
    }
    const fromIdx = STAGE_ORDER.indexOf(opp.stage as (typeof STAGE_ORDER)[number]);
    const toIdx = STAGE_ORDER.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) throw new BadRequestException(`invalid stage ${to}`);
    if (toIdx !== fromIdx + 1 && toIdx !== fromIdx) {
      throw new BadRequestException(`stage must advance one step; ${opp.stage} → ${to} not allowed`);
    }

    return this.prisma.opportunity.update({
      where: { id: opp.id },
      data: {
        stage: to,
        probabilityPct: STAGE_PROBABILITY[to]!,
        stalledSince: null,
      },
    });
  }

  async markLost(tenantId: string, oppNo: string, lostReason: string, competitor?: string) {
    const opp = await this.prisma.opportunity.findFirst({ where: { tenantId, oppNo } });
    if (!opp) throw new NotFoundException(`opportunity ${oppNo} not found`);
    if (opp.stage === "won") throw new ConflictException(`opportunity ${oppNo} is won; cannot mark lost`);
    if (!lostReason) throw new BadRequestException("lostReason is mandatory for lost opportunities");

    return this.prisma.opportunity.update({
      where: { id: opp.id },
      data: { stage: "lost", lostReason, probabilityPct: 0 },
    });
  }

  /** Win = booking handoff. Requires hold/booking_pending stage and an actual booking reference. */
  async handoffToBooking(tenantId: string, oppNo: string, bookingId: string) {
    const opp = await this.prisma.opportunity.findFirst({ where: { tenantId, oppNo } });
    if (!opp) throw new NotFoundException(`opportunity ${oppNo} not found`);
    if (!["hold", "booking_pending"].includes(opp.stage)) {
      throw new ConflictException(`opportunity ${oppNo} at ${opp.stage}; handoff requires hold or booking_pending stage`);
    }

    const updated = await this.prisma.opportunity.update({
      where: { id: opp.id },
      data: { stage: "won", bookingId, probabilityPct: 100 },
    });

    // Attribution continuity (RECRM-011): preserve channel partner credit on the lead
    await this.prisma.lead.update({
      where: { id: opp.leadId },
      data: { status: "won" },
    });

    return updated;
  }

  /** Weighted pipeline = Σ(expectedValue × probability) for open stages. */
  async forecast(tenantId: string, projectId?: string) {
    const opps = await this.prisma.opportunity.findMany({
      where: { tenantId, projectId: projectId ?? undefined },
    });
    const open = opps.filter((o) => !["won", "lost"].includes(o.stage));
    const grossPipelinePaise = open.reduce((s, o) => s + o.expectedValuePaise, 0n);
    const weightedPipelinePaise = open.reduce(
      (s, o) => s + (o.expectedValuePaise * BigInt(o.probabilityPct)) / 100n,
      0n,
    );
    const wonPaise = opps.filter((o) => o.stage === "won").reduce((s, o) => s + o.expectedValuePaise, 0n);
    const lostCount = opps.filter((o) => o.stage === "lost").length;

    const byStage: Record<string, { count: number; valuePaise: bigint }> = {};
    for (const o of open) {
      const bucket = (byStage[o.stage] ??= { count: 0, valuePaise: 0n });
      bucket.count += 1;
      bucket.valuePaise += o.expectedValuePaise;
    }

    return {
      openCount: open.length,
      grossPipelinePaise,
      weightedPipelinePaise,
      wonPaise,
      lostCount,
      byStage,
    };
  }

  // ── Unit interest (RECRM-001/002, CRM-036) ──────────────────────────────

  async addUnitInterest(tenantId: string, oppNo: string, input: {
    unitId?: string;
    towerPref?: string;
    floorPref?: number;
    configType?: string;
    areaPrefSqm?: number;
    budgetPaise?: bigint;
  }) {
    const opp = await this.prisma.opportunity.findFirst({ where: { tenantId, oppNo } });
    if (!opp) throw new NotFoundException(`opportunity ${oppNo} not found`);
    if (opp.stage === "won" || opp.stage === "lost") {
      throw new ConflictException(`opportunity ${oppNo} is ${opp.stage}`);
    }

    if (input.unitId) {
      const unit = await this.prisma.unit.findFirst({ where: { tenantId, id: input.unitId } });
      if (!unit) throw new NotFoundException(`unit ${input.unitId} not found`);
      if (unit.projectId !== opp.projectId) {
        throw new BadRequestException(`unit ${unit.code} is not in opportunity project`);
      }
      if (!["available"].includes(unit.state)) {
        throw new ConflictException(`unit ${unit.code} is ${unit.state}; only available units can be added as interest`);
      }
    }

    // First unit interest advances stage to unit_interest
    if (opp.stage === "prospect" || opp.stage === "qualification") {
      await this.moveStage(tenantId, oppNo, "unit_interest");
    }

    return this.prisma.opportunityUnitInterest.create({
      data: {
        tenantId,
        opportunityId: opp.id,
        unitId: input.unitId,
        towerPref: input.towerPref,
        floorPref: input.floorPref,
        configType: input.configType,
        areaPrefSqm: input.areaPrefSqm,
        budgetPaise: input.budgetPaise,
        status: "active",
      },
    });
  }

  // ── Lead assignment history (CRM-008/011) ───────────────────────────────

  async assignLead(tenantId: string, leadId: string, toUserId: string, assignedBy: string, reason: "rule" | "manual" | "reassign" | "round_robin" | "bulk" = "manual") {
    const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: leadId } });
    if (!lead) throw new NotFoundException(`lead ${leadId} not found`);
    if (["won", "lost", "disqualified"].includes(lead.status)) {
      throw new ConflictException(`lead is ${lead.status}; cannot reassign`);
    }

    await this.prisma.lead.update({
      where: { id: lead.id },
      data: { assignedUserId: toUserId },
    });
    return this.prisma.leadAssignmentLog.create({
      data: {
        tenantId,
        leadId: lead.id,
        fromUserId: lead.assignedUserId,
        toUserId,
        reason,
        assignedBy,
        at: new Date(),
      },
    });
  }

  async assignmentHistory(tenantId: string, leadId: string) {
    return this.prisma.leadAssignmentLog.findMany({
      where: { tenantId, leadId },
      orderBy: { at: "desc" },
    });
  }

  // ── Site visit lifecycle (CRM-045..051) ─────────────────────────────────

  async confirmVisit(tenantId: string, visitId: string) {
    const visit = await this.prisma.siteVisit.findFirst({ where: { tenantId, id: visitId } });
    if (!visit) throw new NotFoundException(`site visit ${visitId} not found`);
    if (visit.status !== "scheduled") throw new ConflictException(`visit is ${visit.status}`);
    return this.prisma.siteVisit.update({
      where: { id: visit.id },
      data: { status: "confirmed", confirmedAt: new Date() },
    });
  }

  async completeVisit(tenantId: string, visitId: string, outcome: string, feedback?: string) {
    const visit = await this.prisma.siteVisit.findFirst({ where: { tenantId, id: visitId } });
    if (!visit) throw new NotFoundException(`site visit ${visitId} not found`);
    if (!["scheduled", "confirmed"].includes(visit.status)) {
      throw new ConflictException(`visit is ${visit.status}; cannot complete`);
    }
    return this.prisma.siteVisit.update({
      where: { id: visit.id },
      data: { status: "done", outcome, feedback, completedAt: new Date() },
    });
  }

  async markNoShow(tenantId: string, visitId: string) {
    const visit = await this.prisma.siteVisit.findFirst({ where: { tenantId, id: visitId } });
    if (!visit) throw new NotFoundException(`site visit ${visitId} not found`);
    if (visit.status !== "scheduled" && visit.status !== "confirmed") {
      throw new ConflictException(`visit is ${visit.status}; cannot mark no-show`);
    }
    return this.prisma.siteVisit.update({
      where: { id: visit.id },
      data: { status: "no_show" },
    });
  }

  /** Visit → opportunity conversion rate (RECRM-008 funnel). */
  async visitFunnel(tenantId: string) {
    const visits = await this.prisma.siteVisit.findMany({ where: { tenantId } });
    const done = visits.filter((v) => v.status === "done");
    const noShow = visits.filter((v) => v.status === "no_show");
    const opps = await this.prisma.opportunity.findMany({ where: { tenantId } });
    const oppLeadIds = new Set(opps.map((o) => o.leadId));
    const withOpportunity = done.filter((v) => oppLeadIds.has(v.leadId)).length;

    return {
      totalVisits: visits.length,
      completed: done.length,
      noShow: noShow.length,
      completionPct: visits.length > 0 ? Math.round((done.length / visits.length) * 100) : 0,
      visitToOpportunityPct: done.length > 0 ? Math.round((withOpportunity / done.length) * 100) : 0,
    };
  }
}
