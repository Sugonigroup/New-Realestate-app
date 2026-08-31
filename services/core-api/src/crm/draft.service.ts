import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { LlmGateway } from "../ai/gateway.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CrmCommsService } from "./comms.service.js";

/**
 * AI communication drafts (CRM-112/113), routed through the LLM gateway:
 * - Lead context is gathered server-side and PII-masked before any LLM call
 * - Drafts are NEVER auto-sent: they land in a draft queue; approval sends them
 *   through the consent-gated comms service (human-in-loop, RECRM-014 safe)
 * - Cost accounting per draft (model, promptHash, costPaise) via gateway response
 */

const INTENTS = [
  "follow_up", "visit_reminder", "reactivation", "festival_greeting", "price_revision",
] as const;

type Intent = (typeof INTENTS)[number];

const INTENT_PROMPTS: Record<Intent, string> = {
  follow_up: "Write a short warm follow-up message asking about their interest and next step.",
  visit_reminder: "Write a polite site-visit reminder with date confirmation.",
  reactivation: "Write a friendly non-promotional check-in for a lead gone quiet.",
  festival_greeting: "Write a short festive greeting. No sales pitch.",
  price_revision: "Write a message informing about a price revision and urging timely decision.",
};

@Injectable()
export class CrmDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly comms: CrmCommsService,
    private readonly gateway: LlmGateway,
  ) {}

  async draftCommunication(tenantId: string, input: {
    leadId: string;
    channel: "email" | "whatsapp" | "sms";
    intent: Intent;
  }) {
    const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: input.leadId } });
    if (!lead) throw new NotFoundException(`lead ${input.leadId} not found`);

    const interactions = await this.prisma.interaction.findMany({
      where: { tenantId, leadId: lead.id as string },
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    // Server-side context — masked before leaving the process (16 §5)
    const context = [
      `Lead: ${lead.fullName}. Status: ${lead.status}. Score: ${lead.score}/100. Source: ${lead.source}.`,
      lead.projectId ? `Project interest: ${lead.projectId}.` : "",
      interactions.length > 0
        ? `Recent touches: ${interactions.map((i) => `${i.type}(${String(i.disposition ?? "n/a")})`).join(", ")}.`
        : "No prior interactions.",
      INTENT_PROMPTS[input.intent],
      `Channel: ${input.channel}. Keep it under 80 words. Do not include prices or promises.`,
    ].filter(Boolean).join(" ");

    const res = await this.gateway.complete({
      taskClass: "narrate",
      agentCode: "crm_draft_agent",
      prompt: context,
      maxTokens: 220,
    });

    return this.prisma.crmDraft.create({
      data: {
        tenantId,
        leadId: lead.id as string,
        channel: input.channel,
        intent: input.intent,
        body: res.text,
        model: res.model,
        promptHash: res.promptHash,
        costPaise: res.costPaise,
        status: "draft",
      },
    });
  }

  async listDrafts(tenantId: string, status: string = "draft") {
    return this.prisma.crmDraft.findMany({
      where: { tenantId, status },
      orderBy: { createdAt: "desc" },
    });
  }

  async discardDraft(tenantId: string, draftId: string) {
    const draft = await this.prisma.crmDraft.findFirst({ where: { tenantId, id: draftId } });
    if (!draft) throw new NotFoundException(`draft ${draftId} not found`);
    if (draft.status !== "draft") throw new ConflictException(`draft is ${draft.status}`);
    return this.prisma.crmDraft.update({ where: { id: draft.id }, data: { status: "discarded" } });
  }

  /** Approve = send now through the consent gate. Records the linked communication. */
  async approveAndSend(tenantId: string, draftId: string, approvedBy: string) {
    const draft = await this.prisma.crmDraft.findFirst({ where: { tenantId, id: draftId } });
    if (!draft) throw new NotFoundException(`draft ${draftId} not found`);
    if (draft.status !== "draft") throw new ConflictException(`draft is ${draft.status}`);

    const comm = await this.comms.send(tenantId, {
      leadId: draft.leadId as string,
      channel: draft.channel as "email" | "whatsapp" | "sms",
      body: draft.body as string,
    });

    // Consent-blocked sends keep the draft alive for revision
    const draftStatus = comm.deliveryStatus === "sent" ? "approved" : "draft";
    await this.prisma.crmDraft.update({
      where: { id: draft.id },
      data: {
        status: draftStatus,
        approvedBy: draftStatus === "approved" ? approvedBy : undefined,
        sentCommId: draftStatus === "approved" ? (comm.id as string) : undefined,
      },
    });
    return { draftId: draft.id, communication: comm, approved: draftStatus === "approved" };
  }
}

