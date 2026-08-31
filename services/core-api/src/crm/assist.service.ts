import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CRM AI assist layer (CRM-109/114/120/121, CRM-067):
 * - Next-best-action recommendation engine over lead/opportunity/interaction data:
 *     sla_at_risk (SLA due within 2h unresponded), stalled_opportunity (no stage change
 *     in 10 days), inactive_lead (no interaction in 14 days), hot_lead_visit
 *     (score >= 70, never visited)
 * - Every recommendation carries reason → evidence → confidence → impact → owner → due
 *   (spec §6 AI panel format); ALL writes require human acceptance (CRM-121)
 * - Acceptance creates a CrmTask; rejection is recorded (audit)
 * - Read-only copilot brief (CRM-120): deterministic aggregation of a lead's
 *   timeline/state — no LLM writes, no bypass of permissions
 */

const DAY = 86_400_000;

@Injectable()
export class CrmAssistService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Recommendation engine (CRM-109/114) ─────────────────────────────────

  async generateRecommendations(tenantId: string, asOf: Date = new Date()) {
    const created: Array<{ recType: string; targetId: string }> = [];

    // 1. SLA at risk: unresponded leads whose SLA responds-by is within 2 hours
    const slaAtRisk = await this.prisma.lead.findMany({
      where: {
        tenantId,
        status: "new",
        slaRespondBy: { not: null, gte: asOf, lte: new Date(asOf.getTime() + 2 * 3600_000) },
      },
    });
    for (const lead of slaAtRisk) {
      const ok = await this.upsertRec(tenantId, {
        recType: "sla_at_risk", targetType: "lead", targetId: lead.id as string,
        reason: `SLA responds-by ${new Date(lead.slaRespondBy as unknown as string).toISOString()} — call within ${Math.max(0, Math.round(((lead.slaRespondBy as unknown as number) - asOf.getTime()) / 60000))} min`,
        evidence: { slaRespondBy: lead.slaRespondBy, status: lead.status, source: lead.source },
        confidence: 95, impact: "high",
        ownerUserId: lead.assignedUserId, dueOn: new Date(lead.slaRespondBy as unknown as string),
      });
      if (ok) created.push({ recType: "sla_at_risk", targetId: lead.id as string });
    }

    // 2. Stalled opportunities: open, no movement for 10+ days
    const cutoff = new Date(asOf.getTime() - 10 * DAY);
    const stalled = await this.prisma.opportunity.findMany({
      where: { tenantId, stage: { notIn: ["won", "lost"] }, stalledSince: { lte: cutoff } },
    });
    for (const opp of stalled) {
      const ok = await this.upsertRec(tenantId, {
        recType: "stalled_opportunity", targetType: "opportunity", targetId: opp.id as string,
        reason: `No stage movement since ${new Date(opp.stalledSince as unknown as string).toISOString()} at stage ${opp.stage}`,
        evidence: { stage: opp.stage, stalledSince: opp.stalledSince, probabilityPct: opp.probabilityPct },
        confidence: 85, impact: "medium",
        ownerUserId: opp.assignedUserId, dueOn: new Date(asOf.getTime() + 2 * DAY),
      });
      if (ok) created.push({ recType: "stalled_opportunity", targetId: opp.id as string });
    }

    // 3. Inactive leads: contacted+ but no interaction in 14 days
    const activeLeads = await this.prisma.lead.findMany({
      where: { tenantId, status: { in: ["contacted", "qualified", "visit_scheduled", "visited", "negotiation"] } },
      include: { interactions: true },
    });
    for (const lead of activeLeads) {
      const last = lead.interactions
        .map((i) => i.createdAt as Date)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const lastAt = last ?? (lead.createdAt as Date);
      if (asOf.getTime() - lastAt.getTime() < 14 * DAY) continue;
      const ok = await this.upsertRec(tenantId, {
        recType: "inactive_lead", targetType: "lead", targetId: lead.id as string,
        reason: `No interaction for ${Math.round((asOf.getTime() - lastAt.getTime()) / DAY)} days (last: ${lastAt.toISOString()})`,
        evidence: { lastInteractionAt: lastAt, interactionCount: lead.interactions.length, score: lead.score },
        confidence: 75, impact: "medium",
        ownerUserId: lead.assignedUserId, dueOn: new Date(asOf.getTime() + 3 * DAY),
      });
      if (ok) created.push({ recType: "inactive_lead", targetId: lead.id as string });
    }

    // 4. Hot leads never visited: score >= 70, status not yet visit_scheduled+
    const hot = await this.prisma.lead.findMany({
      where: { tenantId, score: { gte: 70 }, status: { in: ["new", "contacted", "qualified"] } },
    });
    for (const lead of hot) {
      const ok = await this.upsertRec(tenantId, {
        recType: "hot_lead_visit", targetType: "lead", targetId: lead.id as string,
        reason: `Score ${lead.score} but no site visit scheduled — schedule within 3 days`,
        evidence: { score: lead.score, status: lead.status, budgetPaise: lead.budgetPaise },
        confidence: 80, impact: "high",
        ownerUserId: lead.assignedUserId, dueOn: new Date(asOf.getTime() + 3 * DAY),
      });
      if (ok) created.push({ recType: "hot_lead_visit", targetId: lead.id as string });
    }

    return { generated: created.length, recommendations: created };
  }

  /** Dedupe: skip if a pending rec of same type+target already exists. */
  private async upsertRec(tenantId: string, input: {
    recType: string; targetType: string; targetId: string; reason: string;
    evidence: object; confidence: number; impact: string; ownerUserId?: string | null; dueOn?: Date;
  }): Promise<boolean> {
    const existing = await this.prisma.crmRecommendation.findFirst({
      where: { tenantId, recType: input.recType, targetId: input.targetId, status: "pending" },
    });
    if (existing) return false;
    await this.prisma.crmRecommendation.create({
      data: {
        tenantId,
        recType: input.recType,
        targetType: input.targetType,
        targetId: input.targetId,
        reason: input.reason,
        evidence: input.evidence,
        confidence: input.confidence,
        impact: input.impact,
        ownerUserId: input.ownerUserId ?? null,
        dueOn: input.dueOn,
        status: "pending",
      },
    });
    return true;
  }

  async listRecommendations(tenantId: string, status: string = "pending") {
    return this.prisma.crmRecommendation.findMany({
      where: { tenantId, status },
      orderBy: [{ impact: "asc" }, { createdAt: "desc" }],
    });
  }

  /** Human approval (CRM-121): accepting a recommendation creates the task. */
  async decideRecommendation(tenantId: string, recId: string, accept: boolean, decidedBy: string) {
    const rec = await this.prisma.crmRecommendation.findFirst({ where: { tenantId, id: recId } });
    if (!rec) throw new NotFoundException(`recommendation ${recId} not found`);
    if (rec.status !== "pending") throw new ConflictException(`recommendation is ${rec.status}`);

    const updated = await this.prisma.crmRecommendation.update({
      where: { id: rec.id },
      data: { status: accept ? "accepted" : "rejected", decidedBy, decidedAt: new Date() },
    });

    if (accept) {
      await this.prisma.crmTask.create({
        data: {
          tenantId,
          leadId: rec.targetType === "lead" ? rec.targetId : null,
          oppNo: rec.targetType === "opportunity" ? rec.targetId : null,
          title: `${rec.recType.replace(/_/g, " ")}: ${rec.reason.slice(0, 80)}`,
          dueOn: rec.dueOn ?? new Date(Date.now() + DAY),
          assigneeId: rec.ownerUserId,
          createdFrom: "ai_recommendation",
          recommendationId: rec.id,
          status: "open",
        },
      });
    }
    return updated;
  }

  // ── Tasks (CRM-067/068) ─────────────────────────────────────────────────

  async createTask(tenantId: string, input: {
    leadId?: string;
    oppNo?: string;
    title: string;
    dueOn: Date;
    assigneeId?: string;
  }) {
    return this.prisma.crmTask.create({
      data: {
        tenantId,
        leadId: input.leadId,
        oppNo: input.oppNo,
        title: input.title,
        dueOn: input.dueOn,
        assigneeId: input.assigneeId,
        createdFrom: "manual",
        status: "open",
      },
    });
  }

  async completeTask(tenantId: string, taskId: string) {
    const task = await this.prisma.crmTask.findFirst({ where: { tenantId, id: taskId } });
    if (!task) throw new NotFoundException(`task ${taskId} not found`);
    if (task.status !== "open") throw new ConflictException(`task is ${task.status}`);
    return this.prisma.crmTask.update({
      where: { id: task.id },
      data: { status: "done", completedAt: new Date() },
    });
  }

  async listTasks(tenantId: string, assigneeId?: string) {
    return this.prisma.crmTask.findMany({
      where: { tenantId, assigneeId: assigneeId ?? undefined, status: "open" },
      orderBy: { dueOn: "asc" },
    });
  }

  // ── Read-only copilot brief (CRM-120) ───────────────────────────────────

  /** Deterministic lead brief — summarizes state for the human operator. */
  // ── Sales diary & site-sales work queue (RECRM-016/017) ────────────────

  /** Prioritized action queue for a sales user: SLA first, then tasks, then reactivations. */
  async workQueue(tenantId: string, userId: string, now: Date = new Date()) {
    const atRisk = await this.prisma.lead.findMany({
      where: {
        tenantId, assignedUserId: userId, status: { in: ["new", "contacted"] },
        slaRespondBy: { not: null, lte: new Date(now.getTime() + 2 * 3600_000) },
      },
    });
    const dormant = await this.prisma.lead.findMany({
      where: { tenantId, assignedUserId: userId, status: "dormant" },
    });
    const tasks = await this.prisma.crmTask.findMany({
      where: { tenantId, assigneeId: userId, status: "open", dueOn: { lte: new Date(now.getTime() + DAY) } },
      orderBy: { dueOn: "asc" },
    });

    const items: Array<{ kind: string; priority: number; ref: string; title: string; dueOn?: Date }> = [];
    for (const l of atRisk) {
      items.push({
        kind: "sla", priority: 0, ref: l.id as string,
        title: `Call ${l.fullName} — SLA ${l.slaRespondBy && new Date(l.slaRespondBy as unknown as string) < now ? "BREACHED" : "at risk"}`,
        dueOn: new Date(l.slaRespondBy as unknown as string),
      });
    }
    for (const t of tasks) {
      items.push({ kind: "task", priority: 1, ref: t.id as string, title: t.title as string, dueOn: t.dueOn as Date });
    }
    for (const l of dormant) {
      items.push({ kind: "reactivate", priority: 2, ref: l.id as string, title: `Reactivate ${l.fullName} (dormant)` });
    }
    items.sort((a, b) => a.priority - b.priority || (a.dueOn?.getTime() ?? Infinity) - (b.dueOn?.getTime() ?? Infinity));
    return { userId, queue: items, slaCount: atRisk.length, taskCount: tasks.length, dormantCount: dormant.length };
  }

  /** Sales diary (RECRM-016): today's calls, visits, tasks completed/open, for one user. */
  async salesDiary(tenantId: string, userId: string, now: Date = new Date()) {
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + DAY);
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, assignedUserId: userId },
      include: { interactions: true },
    });
    const calls: Array<{ leadId: string; leadName: string; disposition: string | null; at: Date }> = [];
    for (const l of leads) {
      for (const i of l.interactions) {
        const at = new Date(i.createdAt as unknown as string);
        if (i.type === "call" && at >= dayStart && at < dayEnd) {
          calls.push({ leadId: l.id as string, leadName: l.fullName as string, disposition: (i.disposition as string) ?? null, at });
        }
      }
    }
    const visits = await this.prisma.siteVisit.findMany({
      where: { tenantId, scheduledAt: { gte: dayStart, lt: dayEnd } },
    });
    const tasksDone = await this.prisma.crmTask.findMany({
      where: { tenantId, assigneeId: userId, status: "done", completedAt: { gte: dayStart, lt: dayEnd } },
    });
    const tasksOpen = await this.prisma.crmTask.findMany({
      where: { tenantId, assigneeId: userId, status: "open", dueOn: { lt: dayEnd } },
    });
    return {
      date: dayStart.toISOString().slice(0, 10),
      calls: calls.sort((a, b) => a.at.getTime() - b.at.getTime()),
      callCount: calls.length,
      visitsToday: visits.length,
      tasksCompleted: tasksDone.length,
      tasksOpen: tasksOpen.length,
    };
  }

  async copilotBrief(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { tenantId, id: leadId },
      include: { interactions: true },
    });
    if (!lead) throw new NotFoundException(`lead ${leadId} not found`);

    const opps = await this.prisma.opportunity.findMany({ where: { tenantId, leadId } });
    const tasks = await this.prisma.crmTask.findMany({ where: { tenantId, leadId, status: "open" } });

    const byType = new Map<string, number>();
    for (const i of lead.interactions) byType.set(i.type as string, (byType.get(i.type as string) ?? 0) + 1);

    const last = lead.interactions.map((i) => i.createdAt as Date).sort((a, b) => b.getTime() - a.getTime())[0];
    const daysSinceLast = last ? Math.floor((Date.now() - last.getTime()) / DAY) : null;

    const points: string[] = [];
    points.push(`Lead ${lead.fullName} is ${lead.status} with score ${lead.score}/100 (source: ${lead.source}).`);
    if (daysSinceLast !== null) points.push(`Last touch was ${daysSinceLast} day(s) ago across ${lead.interactions.length} interaction(s).`);
    if (opps.length > 0) points.push(`${opps.length} opportunity pipeline(s): ${opps.map((o) => `${o.oppNo}@${o.stage}`).join(", ")}.`);
    else points.push("No opportunity created yet.");
    if (!lead.firstRespondedAt) points.push("WARNING: no first response recorded — SLA risk.");
    if (tasks.length > 0) points.push(`${tasks.length} open task(s) pending.`);

    const nextBest = !lead.firstRespondedAt
      ? "Make the first call immediately (SLA)."
      : daysSinceLast !== null && daysSinceLast >= 14
      ? "Reactivation touch due — send a non-promotional check-in."
      : opps.length === 0 && lead.score >= 60
      ? "Qualify and create an opportunity."
      : "Continue current cadence.";

    return {
      leadId,
      summary: points.join(" "),
      interactionBreakdown: Object.fromEntries(byType),
      daysSinceLastTouch: daysSinceLast,
      openTasks: tasks.length,
      nextBestAction: nextBest,
    };
  }
}
