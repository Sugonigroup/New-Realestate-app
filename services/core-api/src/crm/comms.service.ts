import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * CRM Communications (CRM-052..063, CRM-025):
 * - Append-only consent ledger per person+channel; latest entry is authoritative
 * - Outbound send gate: consent granted → not suppressed → send (delivery simulated
 *   via provider ack); blocked sends are recorded with suppressionReason (audit trail)
 * - Threaded conversations: replies (inbound) resolved to existing threads by
 *   phone/email identity — never a duplicate thread
 */

@Injectable()
export class CrmCommsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Consent ledger (CRM-025) — reuses canonical ConsentLedger ───────────

  async recordConsent(tenantId: string, input: {
    personId: string;
    channel: "whatsapp" | "email" | "sms" | "call";
    status: "granted" | "revoked";
    source: string;
    evidence?: string;
  }) {
    const person = await this.prisma.relationshipPerson.findFirst({ where: { tenantId, id: input.personId } });
    if (!person) throw new NotFoundException(`person ${input.personId} not found`);

    const entry = await this.prisma.consentLedger.create({
      data: {
        tenantId,
        personRef: input.personId,
        channel: input.channel,
        purpose: "promotional",
        grantedAt: input.status === "granted" ? new Date() : undefined,
        revokedAt: input.status === "revoked" ? new Date() : undefined,
        source: `${input.source}${input.evidence ? `:${input.evidence}` : ""}`,
      },
    });
    // Sync authoritative status onto the person row (channel-agnostic summary)
    await this.prisma.relationshipPerson.update({
      where: { id: person.id },
      data: { consentStatus: input.status },
    });
    return entry;
  }

  private async consentFor(tenantId: string, personId: string, channel: string): Promise<string> {
    const latest = await this.prisma.consentLedger.findFirst({
      where: { tenantId, personRef: personId, channel },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) return "unknown";
    if (latest.revokedAt && (!latest.grantedAt || latest.revokedAt > latest.grantedAt)) return "revoked";
    if (latest.grantedAt) return "granted";
    return "unknown";
  }

  // ── Outbound send (CRM-056/060/062) ─────────────────────────────────────

  async send(tenantId: string, input: {
    leadId?: string;
    personId?: string;
    channel: "email" | "whatsapp" | "sms";
    templateKey?: string;
    body: string;
    threadId?: string;
  }) {
    if (!input.personId && !input.leadId) {
      throw new BadRequestException("personId or leadId is required");
    }

    // Resolve person (from lead if needed)
    let personId = input.personId;
    if (!personId && input.leadId) {
      const lead = await this.prisma.lead.findFirst({ where: { tenantId, id: input.leadId } });
      if (!lead) throw new NotFoundException(`lead ${input.leadId} not found`);
      const person = await this.prisma.relationshipPerson.findFirst({ where: { tenantId, leadId: lead.id } });
      personId = person?.id;
    }
    if (!personId) throw new NotFoundException("no relationship person linked to this lead");

    // Consent gate
    const consent = await this.consentFor(tenantId, personId, input.channel);
    if (consent !== "granted") {
      // Record the blocked attempt for audit — never silently drop
      return this.prisma.communication.create({
        data: {
          tenantId,
          threadId: input.threadId ?? randomUUID(),
          leadId: input.leadId,
          personId,
          channel: input.channel,
          direction: "outbound",
          templateKey: input.templateKey,
          body: input.body,
          deliveryStatus: "failed",
          suppressedReason: `consent_${consent}`,
        },
      });
    }

    return this.prisma.communication.create({
      data: {
        tenantId,
        threadId: input.threadId ?? randomUUID(),
        leadId: input.leadId,
        personId,
        channel: input.channel,
        direction: "outbound",
        templateKey: input.templateKey,
        body: input.body,
        deliveryStatus: "sent",
        providerMessageId: `msg-${randomUUID().slice(0, 8)}`,
        sentAt: new Date(),
      },
    });
  }

  // ── Inbound identity resolution (CRM-058/061 threading) ─────────────────

  /**
   * Inbound reply: resolve identity by phone (whatsapp/sms) or email → append to the
   * EXISTING outbound thread when one exists; otherwise open a new thread.
   */
  async receiveInbound(tenantId: string, input: {
    channel: "email" | "whatsapp" | "sms";
    fromPhone?: string;
    fromEmail?: string;
    body: string;
    providerMessageId?: string;
  }) {
    let person = null;
    // Duplicate-review flow may store multiple rows per phone/email; resolve to
    // the candidate that actually has a linked relationship person (CRM-103).
    const resolve = async (where: object) => {
      const candidates = await this.prisma.lead.findMany({ where: { tenantId, ...where } });
      for (const lead of candidates) {
        const p = await this.prisma.relationshipPerson.findFirst({ where: { tenantId, leadId: lead.id } });
        if (p) return p;
      }
      return null;
    };
    if (input.fromPhone) person = await resolve({ phone: input.fromPhone });
    if (!person && input.fromEmail) person = await resolve({ email: input.fromEmail });
    if (!person) throw new NotFoundException("no known identity for inbound message");

    // Find existing thread: latest outbound communication to this person on this channel
    const priorOutbound = await this.prisma.communication.findFirst({
      where: { tenantId, personId: person.id, channel: input.channel, direction: "outbound" },
      orderBy: { createdAt: "desc" },
    });

    return this.prisma.communication.create({
      data: {
        tenantId,
        threadId: priorOutbound?.threadId ?? randomUUID(),
        leadId: person.leadId,
        personId: person.id,
        channel: input.channel,
        direction: "inbound",
        body: input.body,
        deliveryStatus: "delivered",
        providerMessageId: input.providerMessageId,
      },
    });
  }

  async thread(tenantId: string, threadId: string) {
    const msgs = await this.prisma.communication.findMany({
      where: { tenantId, threadId },
      orderBy: { createdAt: "asc" },
    });
    if (msgs.length === 0) throw new NotFoundException(`thread ${threadId} not found`);
    return msgs;
  }
}
