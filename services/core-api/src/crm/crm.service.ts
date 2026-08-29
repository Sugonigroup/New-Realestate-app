import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { normalizeLead } from "./normalize.js";
import { dedupDecision, type ExistingLead } from "./dedup.js";
import { route, type RoutingRule } from "./routing.js";
import { slaRespondBy } from "./sla.js";
import { scoreLead } from "./scoring.js";

export interface IngestInput {
  tenantId: string;
  source: string;
  sourceRef?: string;
  projectId?: string;
  campaignId?: string;
  fullName: string;
  phone: string;
  email?: string;
  budgetPaise?: bigint;
  segment?: string;
  language?: string;
}

export interface IngestOutcome {
  status: "created" | "duplicate" | "rejected";
  leadId?: string;
  reason?: string;
  dedupFlag?: string;
  assignedUserId?: string;
}

export interface RoutingContext {
  rules: RoutingRule[];
  userLoad: Map<string, number>;
  lastAssigned: Map<string, number>;
}

/**
 * Ingestion pipeline (WP-1A): normalize → dedup → route → persist → notify SLA.
 * Single entry point for every source (website, Meta/Google, portals, IVR,
 * WhatsApp inbound, walk-ins, partner imports, CSV).
 */
@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(input: IngestInput, routing: RoutingContext): Promise<IngestOutcome> {
    const normalized = normalizeLead(input);
    if ("error" in normalized) return { status: "rejected", reason: normalized.error };

    const existing = await this.prisma.lead.findMany({
      where: { tenantId: input.tenantId, phone: normalized.phone },
      take: 20,
    });
    const decision = dedupDecision(
      existing.map((l) => ({ id: l.id, phone: l.phone, email: l.email, projectId: l.projectId, status: l.status })),
      { phone: normalized.phone, email: normalized.email, projectId: input.projectId },
    );
    if (decision.kind === "duplicate") {
      return { status: "duplicate", leadId: decision.matchLeadId, reason: decision.reason, dedupFlag: "duplicate" };
    }

    const routed = route(
      { projectId: input.projectId, segment: input.segment, language: input.language ?? "en" },
      routing.rules,
      routing.userLoad,
      routing.lastAssigned,
    );
    const now = new Date();
    const lead = await this.prisma.lead.create({
      data: {
        tenantId: input.tenantId,
        projectId: input.projectId,
        source: input.source,
        sourceRef: input.sourceRef,
        campaignId: input.campaignId,
        fullName: normalized.fullName,
        phone: normalized.phone,
        email: normalized.email,
        budgetPaise: input.budgetPaise,
        segment: input.segment,
        language: input.language ?? "en",
        status: "new",
        score: scoreLead({
          source: input.source,
          createdDaysAgo: 0,
          lastActivityDaysAgo: null,
          interactionCount: 0,
          hasDoneVisit: false,
          budgetPaise: input.budgetPaise ?? null,
          projectMinBudgetPaise: null,
        }).score,
        assignedUserId: routed?.assignedUserId,
        slaRespondBy: slaRespondBy(now),
        dedupFlag: decision.kind === "linked" ? "linked" : null,
        matchLeadId: decision.matchLeadId,
      },
    });
    await this.prisma.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregate: "lead",
        type: "lead.created.v1",
        payload: {
          leadId: lead.id,
          source: input.source,
          projectId: input.projectId,
          assignedUserId: routed?.assignedUserId,
          dedupKind: decision.kind,
        },
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        actorKind: "system",
        action: "crm.lead.ingested",
        entityType: "lead",
        entityId: lead.id,
        after: { source: input.source, dedup: decision.reason, routedTo: routed?.assignedUserId ?? routed?.assignedRole },
      },
    });
    return {
      status: "created",
      leadId: lead.id,
      dedupFlag: decision.kind === "linked" ? "linked" : undefined,
      assignedUserId: routed?.assignedUserId,
    };
  }

  /** First human/agent response stops the SLA clock and moves the pipeline. */
  async addInteraction(
    tenantId: string,
    leadId: string,
    input: { type: string; disposition?: string; notes?: string; byUserId?: string },
  ): Promise<{ interactionId: string; leadStatus: string }> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, tenantId } });
    if (!lead) throw new NotFoundException("lead not found");

    const interaction = await this.prisma.interaction.create({
      data: {
        tenantId,
        leadId,
        type: input.type,
        disposition: input.disposition,
        notes: input.notes,
        byUserId: input.byUserId,
      },
    });

    const isFirstResponse = !lead.firstRespondedAt;
    const nextStatus =
      lead.status === "new" && (input.type === "call" || input.type === "whatsapp" || input.type === "email")
        ? "contacted"
        : lead.status;
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: nextStatus,
        ...(isFirstResponse ? { firstRespondedAt: interaction.createdAt } : {}),
      },
    });
    return { interactionId: interaction.id, leadStatus: nextStatus };
  }

  /** CSV bulk import with per-row validation report (WP-1A acceptance). */
  async importCsv(
    tenantId: string,
    csv: string,
    routing: RoutingContext,
    defaults: { source?: string; projectId?: string } = {},
  ): Promise<{ imported: number; duplicates: number; rejected: Array<{ row: number; reason: string }> }> {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { imported: 0, duplicates: 0, rejected: [] };
    const header = lines[0]!.split(",").map((h) => h.trim());
    const idx = (col: string) => header.indexOf(col);
    let imported = 0;
    let duplicates = 0;
    const rejected: Array<{ row: number; reason: string }> = [];

    for (let row = 1; row < lines.length; row++) {
      const cols = lines[row]!.split(",").map((c) => c.trim());
      const outcome = await this.ingest(
        {
          tenantId,
          source: defaults.source ?? "import",
          projectId: defaults.projectId,
          fullName: idx("fullName") >= 0 ? cols[idx("fullName")] ?? "" : "",
          phone: idx("phone") >= 0 ? cols[idx("phone")] ?? "" : "",
          email: idx("email") >= 0 ? cols[idx("email")] : undefined,
          segment: idx("segment") >= 0 ? cols[idx("segment")] || undefined : undefined,
          language: idx("language") >= 0 ? cols[idx("language")] || undefined : undefined,
        },
        routing,
      );
      if (outcome.status === "created") imported += 1;
      else if (outcome.status === "duplicate") duplicates += 1;
      else rejected.push({ row, reason: outcome.reason ?? "unknown" });
    }
    return { imported, duplicates, rejected };
  }
}
