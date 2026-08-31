import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Vishesh Engagement Engine (§28):
 * - Recurring relationship events (birthday/anniversary/festival/custom Vishesh) with
 *   leap-year clamping (29 Feb → 28 Feb on non-leap years)
 * - Engagement planning runs the full anti-spam gate chain (§28.9):
 *     consent → event active/visibility → policy channel → quiet hours →
 *     frequency cap per occurrence → one message per person per day → approval policy
 * - Approval queue: approvalRequired policies park executions at "planned";
 *   approve() then execute() sends.
 */

const VALID_EVENT_TYPES = [
  "BIRTHDAY", "WEDDING_ANNIVERSARY", "ENGAGEMENT_ANNIVERSARY", "CHILD_BIRTHDAY",
  "COMPANY_ANNIVERSARY", "BOOKING_ANNIVERSARY", "REGISTRATION_ANNIVERSARY",
  "POSSESSION_ANNIVERSARY", "RELATIONSHIP_ANNIVERSARY", "PARTNER_ANNIVERSARY",
  "FESTIVAL", "NATIONAL_HOLIDAY", "CUSTOM_VISHESH",
];

@Injectable()
export class EngagementService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Persons & events ────────────────────────────────────────────────────

  async registerPerson(tenantId: string, input: {
    personType: "lead" | "customer" | "contact" | "partner" | "employee";
    displayName: string;
    preferredLanguage?: string;
    preferredChannel?: "whatsapp" | "email" | "sms" | "call";
    consentStatus?: "granted" | "revoked" | "unknown";
    customerId?: string;
    leadId?: string;
    partnerId?: string;
    employeeId?: string;
    city?: string;
    state?: string;
  }) {
    return this.prisma.relationshipPerson.create({
      data: {
        tenantId,
        personType: input.personType,
        displayName: input.displayName,
        preferredLanguage: input.preferredLanguage ?? "en",
        preferredChannel: input.preferredChannel ?? "whatsapp",
        consentStatus: input.consentStatus ?? "unknown",
        customerId: input.customerId,
        leadId: input.leadId,
        partnerId: input.partnerId,
        employeeId: input.employeeId,
        city: input.city,
        state: input.state,
      },
    });
  }

  async setConsent(tenantId: string, personId: string, status: "granted" | "revoked") {
    const person = await this.prisma.relationshipPerson.findFirst({ where: { tenantId, id: personId } });
    if (!person) throw new NotFoundException(`person ${personId} not found`);
    return this.prisma.relationshipPerson.update({
      where: { id: person.id },
      data: { consentStatus: status },
    });
  }

  async addEvent(tenantId: string, personId: string, input: {
    eventType: string;
    month: number;
    day: number;
    verified?: boolean;
    visibility?: "public" | "private";
    customEventKey?: string;
    notes?: string;
  }) {
    const person = await this.prisma.relationshipPerson.findFirst({ where: { tenantId, id: personId } });
    if (!person) throw new NotFoundException(`person ${personId} not found`);
    if (!VALID_EVENT_TYPES.includes(input.eventType)) {
      throw new BadRequestException(`unknown event type ${input.eventType}`);
    }
    if (input.month < 1 || input.month > 12 || input.day < 1 || input.day > 31) {
      throw new BadRequestException("month must be 1-12 and day 1-31");
    }
    return this.prisma.relationshipEvent.create({
      data: {
        tenantId,
        personId: person.id,
        eventType: input.eventType,
        customEventKey: input.customEventKey,
        month: input.month,
        day: input.day,
        isRecurring: true,
        visibility: input.visibility ?? "public",
        verified: input.verified ?? false,
        notes: input.notes,
        active: true,
      },
    });
  }

  async verifyEvent(tenantId: string, eventId: string, verificationSource: string) {
    const event = await this.prisma.relationshipEvent.findFirst({ where: { tenantId, id: eventId } });
    if (!event) throw new NotFoundException(`event ${eventId} not found`);
    return this.prisma.relationshipEvent.update({
      where: { id: event.id },
      data: { verified: true, notes: `${event.notes ?? ""} [verified: ${verificationSource}]`.trim() },
    });
  }

  /** Next occurrence of a (month, day) on/after `from`, clamping 29 Feb → 28 Feb on non-leap years. */
  nextOccurrence(month: number, day: number, from: Date): Date {
    const clampDay = (y: number) => (month === 2 && day === 29 && !this.isLeap(y) ? 28 : day);
    let year = from.getFullYear();
    const candidate = new Date(Date.UTC(year, month - 1, clampDay(year)));
    if (candidate < new Date(Date.UTC(from.getFullYear(), from.getMonth(), from.getDate()))) {
      year += 1;
      return new Date(Date.UTC(year, month - 1, clampDay(year)));
    }
    return candidate;
  }

  private isLeap(y: number): boolean {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  /** Events due within `days` from `asOf`, with computed next occurrence dates. */
  async upcoming(tenantId: string, days: number, asOf: Date = new Date()) {
    const events = await this.prisma.relationshipEvent.findMany({
      where: { tenantId, active: true },
      include: { person: true },
    });
    const horizon = new Date(asOf.getTime() + days * 86_400_000);
    return events
      .map((e) => ({ event: e, nextOn: this.nextOccurrence(e.month as number, e.day as number, asOf) }))
      .filter((x) => x.nextOn <= horizon)
      .sort((a, b) => a.nextOn.getTime() - b.nextOn.getTime());
  }

  // ── Engagement planning (gate chain §28.9) ──────────────────────────────

  /**
   * Plan engagements for all events occurring within each event's policy lead window.
   * Returns planned/suppressed executions with reasons.
   */
  async planEngagements(tenantId: string, asOf: Date = new Date(), plannedHour: number = 11) {
    const persons = new Map<string, { consent: string; preferredChannel: string }>();
    const personRows = await this.prisma.relationshipPerson.findMany({ where: { tenantId } });
    for (const p of personRows) {
      persons.set(p.id, { consent: p.consentStatus as string, preferredChannel: p.preferredChannel as string });
    }

    const policies = await this.prisma.engagementPolicy.findMany({ where: { tenantId, active: true } });
    const results: Array<{ eventId: string; personId: string; status: string; reason?: string; channel?: string }> = [];

    for (const policy of policies) {
      const eventTypes = policy.eventType === "ALL"
        ? VALID_EVENT_TYPES
        : [policy.eventType.replace("CUSTOM:", "")];
      const events = await this.prisma.relationshipEvent.findMany({
        where: { tenantId, active: true, eventType: { in: eventTypes } },
      });

      for (const event of events) {
        const nextOn = this.nextOccurrence(event.month as number, event.day as number, asOf);
        const daysUntil = Math.round((nextOn.getTime() - asOf.getTime()) / 86_400_000);
        if (daysUntil > (policy.leadDays as number)) continue;

        const personId = event.personId as string;
        const person = persons.get(personId);
        const occurrenceKey = `${event.eventType}:${nextOn.toISOString().slice(0, 10)}`;

        // Gate 1: consent
        if (!person || person.consent !== "granted") {
          results.push({ eventId: event.id, personId, status: "suppressed", reason: `consent_${person?.consent ?? "missing"}` });
          continue;
        }
        // Gate 2: privacy visibility — never message private-marked dates
        if (event.visibility === "private") {
          results.push({ eventId: event.id, personId, status: "suppressed", reason: "private_event" });
          continue;
        }
        // Gate 3: channel allowed by policy (fall back to person preference if allowed)
        const allowed = policy.allowedChannels as string[];
        const channel = allowed.includes(person.preferredChannel) ? person.preferredChannel : allowed[0];
        if (!channel) {
          results.push({ eventId: event.id, personId, status: "suppressed", reason: "no_allowed_channel" });
          continue;
        }
        // Gate 4: quiet hours (planned send hour inside quiet window)
        const hour = plannedHour;
        const inQuiet = (policy.quietStartHour as number) > (policy.quietEndHour as number)
          ? hour >= (policy.quietStartHour as number) || hour < (policy.quietEndHour as number)
          : hour >= (policy.quietStartHour as number) && hour < (policy.quietEndHour as number);
        if (inQuiet) {
          results.push({ eventId: event.id, personId, status: "suppressed", reason: "quiet_hours" });
          continue;
        }
        // Gate 5: frequency cap per occurrence
        const prior = await this.prisma.engagementExecution.findMany({
          where: { tenantId, eventId: event.id as string, occurrenceKey, status: { in: ["planned", "approved", "sent"] } },
        });
        if (prior.length >= (policy.maxPerOccurrence as number)) {
          results.push({ eventId: event.id, personId, status: "suppressed", reason: "frequency_cap" });
          continue;
        }
        // Gate 6: one relationship message per person per day — check other executions planned same day
        const sameDay = await this.prisma.engagementExecution.findMany({
          where: { tenantId, personId, plannedAt: { gte: new Date(nextOn.getTime() - 12 * 3600_000), lte: new Date(nextOn.getTime() + 12 * 3600_000) }, status: { in: ["planned", "approved", "sent"] } },
        });
        if (sameDay.length > 0) {
          results.push({ eventId: event.id, personId, status: "suppressed", reason: "duplicate_day_message" });
          continue;
        }

        const plannedAt = new Date(nextOn);
        plannedAt.setUTCHours(plannedHour, 0, 0, 0);
        await this.prisma.engagementExecution.create({
          data: {
            tenantId,
            personId,
            eventId: event.id as string,
            occurrenceKey,
            channel,
            plannedAt,
            status: policy.approvalRequired ? "planned" : "approved",
          },
        });
        results.push({ eventId: event.id, personId, status: policy.approvalRequired ? "planned" : "approved", channel });
      }
    }
    return results;
  }

  async approveExecution(tenantId: string, executionId: string, approverId: string) {
    const exec = await this.prisma.engagementExecution.findFirst({ where: { tenantId, id: executionId } });
    if (!exec) throw new NotFoundException(`execution ${executionId} not found`);
    if (exec.status !== "planned") throw new ConflictException(`execution is ${exec.status}`);
    return this.prisma.engagementExecution.update({
      where: { id: exec.id },
      data: { status: "approved", approvedBy: approverId },
    });
  }

  async suppressExecution(tenantId: string, executionId: string, reason: string) {
    const exec = await this.prisma.engagementExecution.findFirst({ where: { tenantId, id: executionId } });
    if (!exec) throw new NotFoundException(`execution ${executionId} not found`);
    if (exec.status === "sent") throw new ConflictException("sent messages cannot be suppressed");
    return this.prisma.engagementExecution.update({
      where: { id: exec.id },
      data: { status: "suppressed", suppressionReason: reason },
    });
  }

  async executeExecution(tenantId: string, executionId: string) {
    const exec = await this.prisma.engagementExecution.findFirst({ where: { tenantId, id: executionId } });
    if (!exec) throw new NotFoundException(`execution ${executionId} not found`);
    if (exec.status !== "approved") {
      throw new ConflictException(`execution is ${exec.status}; approval required before send`);
    }
    return this.prisma.engagementExecution.update({
      where: { id: exec.id },
      data: { status: "sent", sentAt: new Date() },
    });
  }
}
