import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationService } from "../notify/notification.service.js";
import type { JourneyDefinition } from "../notify/journey.js";
import { scoreLead, type ScoreInput } from "./scoring.js";

/** Journey definitions as data (WP-1B) — template keys resolve per tenant in the hub. */
export const JOURNEY_DEFS = {
  // Instant ack on ingest (the 15-min SLA clock starts in parallel).
  lead_ack: { steps: [{ type: "send", channel: "whatsapp", templateKey: "lead_ack_wa" }] },
  // Warm nurture D2 / D7 / D14 from ingest.
  warm_nurture: {
    steps: [
      { type: "wait", minutes: 60 * 24 * 2 },
      { type: "send", channel: "whatsapp", templateKey: "nurture_d2" },
      { type: "wait", minutes: 60 * 24 * 5 },
      { type: "send", channel: "whatsapp", templateKey: "nurture_d7" },
      { type: "wait", minutes: 60 * 24 * 7 },
      { type: "send", channel: "whatsapp", templateKey: "nurture_d14" },
      { type: "stop" },
    ],
  },
  // Visit reminder — scheduler fires at T-1h before scheduledAt.
  visit_reminder: { steps: [{ type: "send", channel: "whatsapp", templateKey: "visit_reminder" }] },
  // No-show recovery: same-day apology + 3-day rebook push.
  no_show_recovery: {
    steps: [
      { type: "send", channel: "whatsapp", templateKey: "visit_no_show" },
      { type: "wait", minutes: 60 * 24 * 3 },
      { type: "send", channel: "whatsapp", templateKey: "visit_rebook" },
    ],
  },
  // Stale reactivation (30/60/90-day buckets) — nightly job picks the template.
  stale_reactivation: { steps: [{ type: "send", channel: "whatsapp", templateKey: "reactivation" }] },
} satisfies Record<string, JourneyDefinition>;

/** Wires CRM events to the notification hub's journey engine (WP-0H). */
@Injectable()
export class LeadAutomationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
  ) {}

  /** Idempotent per-tenant journey registration (run at tenant onboarding). */
  async registerDefaultJourneys(tenantId: string): Promise<number> {
    for (const [key, definition] of Object.entries(JOURNEY_DEFS)) {
      await this.notify.registerJourney(tenantId, key, definition);
    }
    return Object.keys(JOURNEY_DEFS).length;
  }

  /** lead.created.v1 consumer: instant ack + start nurture. */
  async onLeadCreated(tenantId: string, leadId: string, vars: Record<string, string>): Promise<void> {
    await this.notify.triggerJourney(tenantId, "lead_ack", leadId, { leadId, ...vars });
    const nurture = await this.notify.triggerJourney(tenantId, "warm_nurture", leadId, { leadId, ...vars });
    void nurture; // run state parked with nextRunAt; scheduler resumes it
  }

  /** Nightly scoring job (BullMQ cron in WP-0H's scheduler; direct call here). */
  async rescoreAll(tenantId: string): Promise<{ rescored: number }> {
    const leads = await this.prisma.lead.findMany({
      where: { tenantId, status: { in: ["new", "contacted", "qualified", "visit_scheduled", "visited", "negotiation"] } },
    });
    for (const lead of leads) {
      const score = this.scoreFor(lead);
      await this.prisma.lead.update({ where: { id: lead.id }, data: { score } });
    }
    return { rescored: leads.length };
  }

  /** Explainable score for one lead row (breakdown stored with the decision). */
  scoreFor(lead: {
    source: string;
    createdAt: Date;
    budgetPaise: bigint | null;
    projectId: string | null;
  }, ctx?: { interactionCount?: number; lastActivityAt?: Date | null; hasDoneVisit?: boolean; projectMinBudgetPaise?: bigint | null }): number {
    const now = Date.now();
    const input: ScoreInput = {
      source: lead.source,
      createdDaysAgo: Math.floor((now - lead.createdAt.getTime()) / 86_400_000),
      lastActivityDaysAgo: ctx?.lastActivityAt
        ? Math.max(0, Math.floor((now - ctx.lastActivityAt.getTime()) / 86_400_000))
        : null,
      interactionCount: ctx?.interactionCount ?? 0,
      hasDoneVisit: ctx?.hasDoneVisit ?? false,
      budgetPaise: lead.budgetPaise,
      projectMinBudgetPaise: ctx?.projectMinBudgetPaise ?? null,
    };
    return scoreLead(input).score;
  }
}
