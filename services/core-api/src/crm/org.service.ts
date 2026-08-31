import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CRM P1 extensions: organizations/contacts masters (CRM-026/027/028),
 * dormancy sweep + reactivation (CRM-023/024), audited CSV export (CRM-016),
 * partner lead registration (CRM-091/092).
 */

const DORMANT_AFTER_DAYS = 21;
const DAY = 86_400_000;

@Injectable()
export class CrmOrgService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Organizations & contacts (CRM-026/027/028) ──────────────────────────

  async createOrganization(tenantId: string, input: {
    name: string; gstin?: string; orgType?: "corporate" | "sme" | "proprietor" | "trust" | "huf";
    city?: string; website?: string; notes?: string;
  }) {
    if (input.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(input.gstin)) {
      throw new BadRequestException("invalid GSTIN format");
    }
    const existing = await this.prisma.crmOrganization.findFirst({ where: { tenantId, name: input.name } });
    if (existing) throw new ConflictException(`organization "${input.name}" already exists`);
    return this.prisma.crmOrganization.create({
      data: {
        tenantId, name: input.name, gstin: input.gstin,
        orgType: input.orgType ?? "corporate", city: input.city, website: input.website, notes: input.notes,
      },
    });
  }

  async listOrganizations(tenantId: string, orgType?: string) {
    return this.prisma.crmOrganization.findMany({
      where: { tenantId, active: true, orgType: orgType ?? undefined },
      include: { contacts: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async addContact(tenantId: string, input: {
    organizationId?: string; fullName: string; phone: string; email?: string;
    role?: "decision_maker" | "influencer" | "contact" | "finance";
  }) {
    if (input.organizationId) {
      const org = await this.prisma.crmOrganization.findFirst({ where: { tenantId, id: input.organizationId } });
      if (!org) throw new NotFoundException(`organization ${input.organizationId} not found`);
    }
    const existing = await this.prisma.crmContact.findFirst({ where: { tenantId, phone: input.phone } });
    if (existing) throw new ConflictException(`contact with phone ${input.phone} already exists`);
    return this.prisma.crmContact.create({
      data: {
        tenantId, organizationId: input.organizationId,
        fullName: input.fullName, phone: input.phone, email: input.email,
        role: input.role ?? "contact",
      },
    });
  }

  // ── Dormancy & reactivation (CRM-023/024) ───────────────────────────────

  /** Sweep: contacted+ leads with no interaction for 21+ days → dormant (idempotent via dormantAt). */
  async sweepDormant(tenantId: string, now: Date = new Date()) {
    const candidates = await this.prisma.lead.findMany({
      where: { tenantId, status: { in: ["contacted", "qualified"] }, dormantAt: null },
      include: { interactions: true },
    });
    let count = 0;
    for (const lead of candidates) {
      const last = lead.interactions.map((i) => i.createdAt as Date).sort((a, b) => b.getTime() - a.getTime())[0]
        ?? (lead.createdAt as Date);
      if (now.getTime() - new Date(last).getTime() < DORMANT_AFTER_DAYS * DAY) continue;
      await this.prisma.lead.update({ where: { id: lead.id }, data: { status: "dormant", dormantAt: now } });
      await this.prisma.outboxEvent.create({
        data: { tenantId, aggregate: "lead", type: "lead.dormant.v1", payload: { leadId: lead.id, lastTouchAt: last } },
      });
      count += 1;
    }
    return { dormantCount: count };
  }

  /** Reactivate a dormant lead → contacted, emits event (CRM-024). */
  async reactivate(tenantId: string, leadId: string, actorId: string) {
    const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: leadId } });
    if (!lead) throw new NotFoundException(`lead ${leadId} not found`);
    if (lead.status !== "dormant") throw new ConflictException(`lead is ${lead.status}; only dormant leads reactivate`);
    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: { status: "contacted", dormantAt: null },
    });
    await this.prisma.outboxEvent.create({
      data: { tenantId, aggregate: "lead", type: "lead.reactivated.v1", payload: { leadId, actorId } },
    });
    await this.prisma.auditEvent.create({
      data: { tenantId, actorKind: "human", actorUserId: actorId, action: "crm.lead.reactivated", entityType: "lead", entityId: leadId, after: { from: "dormant" } as object },
    });
    return updated;
  }

  // ── Export with permissions + audit (CRM-016) ───────────────────────────

  /** CSV export of leads; every export is audit-logged with filter + row count. */
  async exportLeadsCsv(tenantId: string, status: string | undefined, actorId: string): Promise<string> {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, status: status ?? undefined },
      orderBy: { createdAt: "desc" },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId, actorKind: "human", actorUserId: actorId, action: "crm.lead.exported",
        entityType: "lead", after: { status: status ?? "all", rowCount: leads.length } as object,
      },
    });
    const header = "lead_id,full_name,phone,email,source,status,score,created_at";
    const rows = leads.map((l) =>
      [l.id, l.fullName, l.phone, l.email ?? "", l.source, l.status, String(l.score), new Date(l.createdAt as unknown as string).toISOString()]
        .map((v) => (v.includes(",") ? `"${v}"` : v)).join(","),
    );
    return [header, ...rows].join("\n");
  }

  // ── Partner lead registration (CRM-091/092) ─────────────────────────────

  /** Channel partner registers a lead; partnerRef preserved through booking for commission credit. */
  async registerPartnerLead(tenantId: string, input: {
    partnerRef: string; fullName: string; phone: string; email?: string;
    projectId?: string; budgetPaise?: bigint; partnerUserId: string;
  }) {
    const existing = await this.prisma.lead.findFirst({ where: { tenantId, phone: input.phone } });
    if (existing) throw new ConflictException(`lead with phone ${input.phone} already exists (dedupe at partner registration)`);
    const lead = await this.prisma.lead.create({
      data: {
        tenantId,
        source: "partner",
        sourceRef: input.partnerRef,
        projectId: input.projectId,
        fullName: input.fullName, phone: input.phone, email: input.email,
        budgetPaise: input.budgetPaise, partnerRef: input.partnerRef,
        status: "new", score: 55, // partner-sourced start higher than cold web
        slaRespondBy: new Date(Date.now() + 4 * 3600_000),
      },
    });
    await this.prisma.outboxEvent.create({
      data: { tenantId, aggregate: "lead", type: "lead.created.v1", payload: { leadId: lead.id, source: "partner", partnerRef: input.partnerRef, registeredBy: input.partnerUserId } },
    });
    await this.prisma.auditEvent.create({
      data: { tenantId, actorKind: "human", actorUserId: input.partnerUserId, action: "crm.lead.partner_registered", entityType: "lead", entityId: lead.id, after: { partnerRef: input.partnerRef } as object },
    });
    return lead;
  }

  /** Partner attribution: leads, visits, opportunities, bookings credited to a partner. */
  async partnerCredit(tenantId: string, partnerRef: string) {
    const leads = await this.prisma.lead.findMany({ where: { tenantId, partnerRef } });
    const leadIds = new Set(leads.map((l) => l.id as string));
    const opps = await this.prisma.opportunity.findMany({ where: { tenantId, leadId: { in: [...leadIds] } } });
    const won = opps.filter((o) => o.stage === "won");
    return {
      partnerRef,
      leads: leads.length,
      opportunities: opps.length,
      wonBookings: won.length,
      wonValuePaise: won.reduce((s, o) => s + (o.expectedValuePaise as bigint), 0n),
    };
  }
}
