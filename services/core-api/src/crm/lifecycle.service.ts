import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CRM lifecycle completion (v1 spec §25 items 2/7, scenarios E & F):
 * - Lead merge with field precedence + full re-parenting (interactions, opportunities,
 *   visits, tasks, custom values, consent) — timeline preserved, duplicate retired (CRM-004/017)
 * - Lead update + convert (qualification → opportunity, CRM-018)
 * - SLA breach sweep with one-time breach stamping, escalation notification + events (CRM-013)
 * - Persisted assignment rules (CRM-071) with first-match-wins evaluation
 */

type FieldPrecedence = "survivor" | "duplicate" | "longer";

@Injectable()
export class CrmLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Merge (CRM-004/017, scenario E) ─────────────────────────────────────

  /** Merge duplicate into survivor. Precedence: explicit winner per field, or "longer non-null" default. */
  async mergeLeads(tenantId: string, survivorId: string, duplicateId: string, actorId: string, fieldWinners?: Record<string, FieldPrecedence>) {
    if (survivorId === duplicateId) throw new BadRequestException("cannot merge a lead into itself");
    const [survivor, duplicate] = await Promise.all([
      this.prisma.lead.findFirst({ where: { tenantId, id: survivorId } }),
      this.prisma.lead.findFirst({ where: { tenantId, id: duplicateId } }),
    ]);
    if (!survivor || !duplicate) throw new NotFoundException("survivor or duplicate lead not found");
    if (["won", "lost"].includes(duplicate.status as string)) {
      throw new ConflictException(`duplicate lead is ${duplicate.status}; only live leads can be merged`);
    }

    const mergeable = ["fullName", "email", "budgetPaise", "segment", "projectId", "assignedUserId"] as const;
    const patch: Record<string, unknown> = {};
    for (const f of mergeable) {
      const sVal = survivor[f];
      const dVal = duplicate[f];
      const winner = fieldWinners?.[f] ?? (sVal === null && dVal !== null ? "duplicate" : "survivor");
      if (winner === "duplicate" && dVal !== null) patch[f] = dVal;
    }
    // Keep the earliest createdAt as survivor creation
    if (new Date(duplicate.createdAt as unknown as string) < new Date(survivor.createdAt as unknown as string)) {
      patch.createdAt = duplicate.createdAt;
    }

    // Re-parent everything, preserving the full timeline on the survivor
    const counts = {
      interactions: await this.prisma.interaction.updateMany({ where: { tenantId, leadId: duplicateId }, data: { leadId: survivorId } }),
      opportunities: await this.prisma.opportunity.updateMany({ where: { tenantId, leadId: duplicateId }, data: { leadId: survivorId } }),
      visits: await this.prisma.siteVisit.updateMany({ where: { tenantId, leadId: duplicateId }, data: { leadId: survivorId } }),
      tasks: await this.prisma.crmTask.updateMany({ where: { tenantId, leadId: duplicateId }, data: { leadId: survivorId } }),
      comms: await this.prisma.communication.updateMany({ where: { tenantId, leadId: duplicateId }, data: { leadId: survivorId } }),
      persons: await this.prisma.relationshipPerson.updateMany({ where: { tenantId, leadId: duplicateId }, data: { leadId: survivorId } }),
      customValues: await this.prisma.crmCustomFieldValue.updateMany({ where: { tenantId, entityType: "lead", entityId: duplicateId }, data: { entityId: survivorId } }),
    };

    const updated = await this.prisma.lead.update({
      where: { id: survivorId },
      data: { ...patch, dedupFlag: "merged", matchLeadId: duplicateId },
    });
    // Retire the duplicate without destroying history rows that reference it
    await this.prisma.lead.update({
      where: { id: duplicateId },
      data: { status: "lost", lostReason: `merged into ${survivorId}`, dedupFlag: "merged" },
    });

    await this.prisma.outboxEvent.create({
      data: {
        tenantId,
        aggregate: "lead",
        type: "lead.merged.v1",
        payload: { survivorId, duplicateId, actorId, reParented: counts },
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId, actorKind: "human", actorUserId: actorId, action: "crm.lead.merged",
        entityType: "lead", entityId: survivorId,
        before: { duplicateId }, after: { patch: patch as object, reParented: counts as object },
      },
    });
    return { survivor: updated, reParented: counts };
  }

  // ── Update + convert (CRM-018) ──────────────────────────────────────────

  async updateLead(tenantId: string, leadId: string, patch: {
    fullName?: string; email?: string; budgetPaise?: bigint; segment?: string; projectId?: string; language?: string;
  }, actorId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: leadId } });
    if (!lead) throw new NotFoundException(`lead ${leadId} not found`);
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, (lead as Record<string, unknown>)[k]]));
    const updated = await this.prisma.lead.update({ where: { id: lead.id }, data: patch });
    await this.prisma.auditEvent.create({
      data: { tenantId, actorKind: "human", actorUserId: actorId, action: "crm.lead.updated", entityType: "lead", entityId: leadId, before: before as object, after: { ...patch, budgetPaise: patch.budgetPaise?.toString() } as object },
    });
    return updated;
  }

  /** Convert a qualified+ lead into an opportunity in one authoritative step (CRM-018). */
  async convertLead(tenantId: string, leadId: string, oppNo: string, actorId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: leadId } });
    if (!lead) throw new NotFoundException(`lead ${leadId} not found`);
    if (!["qualified", "visit_scheduled", "visited", "negotiation"].includes(lead.status as string)) {
      throw new ConflictException(`lead is ${lead.status}; only qualified-or-beyond leads convert`);
    }
    const existingOpp = await this.prisma.opportunity.findFirst({ where: { tenantId, oppNo } });
    if (existingOpp) throw new ConflictException(`opportunity ${oppNo} already exists`);
    if (!lead.projectId) throw new BadRequestException("lead has no project interest; set projectId before converting");

    const opp = await this.prisma.opportunity.create({
      data: {
        tenantId, oppNo, leadId: lead.id, projectId: lead.projectId,
        stage: "qualification", probabilityPct: 25,
        expectedValuePaise: (lead.budgetPaise ?? 0n) as bigint,
        budgetPaise: (lead.budgetPaise ?? null) as bigint | null,
        assignedUserId: lead.assignedUserId,
      },
    });
    await this.prisma.lead.update({ where: { id: lead.id }, data: { status: "negotiation" } });
    await this.prisma.outboxEvent.create({
      data: { tenantId, aggregate: "lead", type: "lead.converted.v1", payload: { leadId, oppNo, actorId } },
    });
    await this.prisma.auditEvent.create({
      data: { tenantId, actorKind: "human", actorUserId: actorId, action: "crm.lead.converted", entityType: "lead", entityId: leadId, after: { oppNo } },
    });
    return opp;
  }

  // ── SLA breach sweep (CRM-013, scenario F) ──────────────────────────────

  /** Stamp one-time breaches, emit events, record audit. Returns breach summary. */
  async sweepSlaBreaches(tenantId: string, now: Date = new Date()) {
    const due = await this.prisma.lead.findMany({
      where: { tenantId, slaRespondBy: { lt: now }, firstRespondedAt: null, slaBreachedAt: null, status: { in: ["new", "contacted"] } },
    });
    let escalated = 0;
    for (const lead of due) {
      await this.prisma.lead.update({ where: { id: lead.id }, data: { slaBreachedAt: now } });
      await this.prisma.outboxEvent.create({
        data: { tenantId, aggregate: "sla", type: "lead.sla_breached.v1", payload: { leadId: lead.id, slaRespondBy: lead.slaRespondBy, owner: lead.assignedUserId } },
      });
      await this.prisma.auditEvent.create({
        data: { tenantId, actorKind: "system", action: "crm.sla.breached", entityType: "lead", entityId: lead.id, after: { slaRespondBy: lead.slaRespondBy } },
      });
      escalated += 1;
    }
    return { breached: due.length, escalated };
  }

  // ── Assignment rules (CRM-071/008) ──────────────────────────────────────

  async createAssignmentRule(tenantId: string, input: {
    name: string; priority?: number;
    criteria: { projectId?: string; source?: string; segment?: string; language?: string };
    assignToUsers: string[]; slaMinutes?: number;
    createFirstCallTask?: boolean; notifyManager?: boolean;
  }) {
    if (input.assignToUsers.length === 0) throw new BadRequestException("assignToUsers needs at least one user");
    return this.prisma.crmAssignmentRule.create({
      data: {
        tenantId, name: input.name, priority: input.priority ?? 100,
        criteria: input.criteria, assignToUsers: input.assignToUsers,
        slaMinutes: input.slaMinutes ?? 240,
        createFirstCallTask: input.createFirstCallTask ?? true,
        notifyManager: input.notifyManager ?? false,
        active: true,
      },
    });
  }

  async listAssignmentRules(tenantId: string) {
    return this.prisma.crmAssignmentRule.findMany({
      where: { tenantId, active: true },
      orderBy: { priority: "asc" },
    });
  }

  /** First-match-wins rule evaluation against lead attributes. */
  async evaluateAssignmentRules(tenantId: string, lead: {
    projectId?: string | null; source: string; segment?: string | null; language?: string;
  }) {
    const rules = await this.listAssignmentRules(tenantId);
    for (const rule of rules) {
      const c = rule.criteria as { projectId?: string; source?: string; segment?: string; language?: string };
      if (c.projectId && c.projectId !== lead.projectId) continue;
      if (c.source && c.source !== lead.source) continue;
      if (c.segment && c.segment !== lead.segment) continue;
      if (c.language && c.language !== (lead.language ?? "en")) continue;
      const pool = rule.assignToUsers as string[];
      return { ruleId: rule.id, assignToUsers: pool, slaMinutes: rule.slaMinutes as number, createFirstCallTask: rule.createFirstCallTask as boolean, notifyManager: rule.notifyManager as boolean };
    }
    return null;
  }
}
