import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { renderTemplate } from "./template.js";
import { canSend, type Channel, type Purpose } from "./consent.js";
import { shouldDefer, DEFAULT_QUIET, type Severity } from "./quiet-hours.js";
import { NOTIFY_PORT, type NotificationPort } from "./port.js";
import { advanceJourney, type JourneyDefinition, type JourneyRunState } from "./journey.js";

const QUIET_DEFER_MINUTES = 60;

export interface SendInput {
  tenantId: string;
  channel: Channel;
  templateKey: string;
  toRef: string;
  toAddress: string;
  purpose: Purpose;
  severity?: Severity;
  vars?: Record<string, string | number>;
  journeyId?: string;
  correlationId?: string;
}

/**
 * The single outbound path (05 §1: feature code never calls providers directly):
 * consent → template → quiet hours → provider → message_log. Every send is auditable.
 */
@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFY_PORT) private readonly adapter: NotificationPort,
  ) {}

  async send(input: SendInput): Promise<{ messageId: string; status: string }> {
    const severity: Severity = input.severity ?? "S2";

    const consents = await this.prisma.consentLedger.findMany({
      where: { tenantId: input.tenantId, personRef: input.toRef, channel: input.channel },
    });
    const consent = canSend(
      consents.map((c) => ({ channel: c.channel as Channel, purpose: c.purpose as Purpose, grantedAt: c.grantedAt, revokedAt: c.revokedAt })),
      input.channel,
      input.purpose,
    );
    if (!consent.allowed) {
      return this.log(input, { status: "suppressed", failureReason: `consent: ${consent.reason}` });
    }

    const template = await this.prisma.notificationTemplate.findFirst({
      where: {
        tenantId: input.tenantId,
        key: input.templateKey,
        channel: input.channel,
        approvalStatus: { in: ["approved", "not_required"] },
      },
      orderBy: { version: "desc" },
    });
    if (!template) throw new NotFoundException(`template ${input.templateKey} (${input.channel}) not found/approved`);

    let body: string;
    try {
      body = renderTemplate(template.body, input.vars ?? {});
    } catch (e) {
      return this.log(input, { status: "failed", failureReason: (e as Error).message });
    }

    const now = new Date();
    if (shouldDefer(now, severity, DEFAULT_QUIET)) {
      return this.log(input, {
        status: "deferred",
        failureReason: "quiet-hours",
        deferUntil: new Date(now.getTime() + QUIET_DEFER_MINUTES * 60_000),
        body,
      });
    }

    const result = await this.adapter.send({
      channel: input.channel,
      toAddress: input.toAddress,
      body,
      subject: template.subject ?? undefined,
      templateKey: input.templateKey,
      category: template.category as "utility" | "marketing" | "authentication",
      correlationId: input.correlationId,
    });
    return this.log(input, {
      status: result.status,
      failureReason: result.failureReason,
      providerId: result.providerId,
      body,
    });
  }

  /** Register a journey definition (upsert by key). */
  async registerJourney(tenantId: string, key: string, def: JourneyDefinition): Promise<string> {
    const existing = await this.prisma.journey.findUnique({ where: { tenantId_key: { tenantId, key } } });
    if (existing) {
      await this.prisma.journey.update({ where: { id: existing.id }, data: { definition: def as object } });
      return existing.id;
    }
    const row = await this.prisma.journey.create({ data: { tenantId, key, definition: def as object } });
    return row.id;
  }

  /** Trigger a journey for a person: runs immediately up to the first wait. */
  async triggerJourney(
    tenantId: string,
    key: string,
    personRef: string,
    vars: Record<string, string>,
    correlationId?: string,
  ): Promise<{ runId: string; status: string; sends: number; nextRunAt?: Date }> {
    const journey = await this.prisma.journey.findUnique({ where: { tenantId_key: { tenantId, key } } });
    if (!journey?.active) throw new NotFoundException(`journey ${key} not found/inactive`);
    const def = journey.definition as unknown as JourneyDefinition;

    let state: JourneyRunState = { stepIndex: 0, status: "running", sends: [] };
    state = advanceJourney(def, state, vars);

    for (const s of state.sends) {
      await this.send({
        tenantId,
        channel: s.channel as Channel,
        templateKey: s.templateKey,
        toRef: personRef,
        toAddress: vars.toAddress ?? personRef,
        purpose: "transactional",
        severity: "S2",
        vars: s.vars,
        correlationId,
      });
    }

    const run = await this.prisma.journeyState.create({
      data: {
        tenantId,
        journeyId: journey.id,
        personRef,
        stepIndex: state.stepIndex,
        status: state.status,
        nextRunAt: state.nextRunAt,
        context: { vars },
      },
    });
    return { runId: run.id, status: state.status, sends: state.sends.length, nextRunAt: state.nextRunAt };
  }

  /** Recent messages for a recipient (audit/ops view). */
  async listMessages(tenantId: string, toRef: string): Promise<unknown[]> {
    return this.prisma.messageLog.findMany({
      where: { tenantId, toRef },
      orderBy: { statusUpdatedAt: "desc" },
      take: 50,
    });
  }

  private async log(
    input: SendInput,
    out: { status: string; failureReason?: string; providerId?: string; deferUntil?: Date; body?: string },
  ): Promise<{ messageId: string; status: string }> {
    const row = await this.prisma.messageLog.create({
      data: {
        tenantId: input.tenantId,
        channel: input.channel,
        templateKey: input.templateKey,
        toRef: input.toRef,
        toAddress: input.toAddress,
        vars: (input.vars ?? {}) as object,
        status: out.status,
        failureReason: out.failureReason,
        deferUntil: out.deferUntil,
        journeyId: input.journeyId,
        correlationId: input.correlationId,
        providerId: out.providerId,
        sentAt: out.status === "sent" ? new Date() : undefined,
      },
    });
    return { messageId: row.id, status: out.status };
  }
}
