import { Injectable, NotFoundException } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { assertTransition, type UnitState } from "./unit-state.js";
import { generateSchedule, type PlanMilestone } from "./schedule.js";
import { computeCancellation, type CancelInitiator } from "./cancellation.js";
import { WorkflowService } from "../workflow/workflow.service.js";
import { NotificationService } from "../notify/notification.service.js";

export interface HoldInput {
  tenantId: string;
  unitId: string;
  userId: string;
  leadId?: string;
  holdHours?: number;
}

export interface SubmitBookingInput {
  tenantId: string;
  unitId: string;
  holdId: string;
  leadId?: string;
  customerName: string;
  customerPhone: string;
  coApplicants?: Array<{ name: string; phone: string; relation?: string }>;
  kyc?: { panRef?: string; aadhaarRef?: string; verified: boolean };
  planCode: string;
  planType: "CLP" | "DPLP" | "PLP";
  milestones: PlanMilestone[];
  /** agreement value BEFORE discount, from the price snapshot (paise) */
  totalPaise: bigint;
  discountPct: number;
  initiatorUserId: string;
}

/**
 * Booking flow (WP-1D): hold → submit (discount → authority-matrix approval) →
 * confirm (immutable price + schedule snapshot, unit→booked, events) — and the
 * cancellation path with forfeiture/RERA-interest math and commission clawback.
 */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflow: WorkflowService,
    private readonly notify: NotificationService,
  ) {}

  async holdUnit(input: HoldInput): Promise<{ holdId: string; expiresAt: Date }> {
    const unit = await this.prisma.unit.findFirst({ where: { id: input.unitId, tenantId: input.tenantId } });
    if (!unit) throw new NotFoundException("unit not found");
    assertTransition(unit.state as UnitState, "held");
    const holdHours = input.holdHours ?? 24;
    const expiresAt = new Date(Date.now() + holdHours * 3_600_000);
    const hold = await this.prisma.hold.create({
      data: {
        tenantId: input.tenantId,
        unitId: input.unitId,
        leadId: input.leadId,
        createdBy: input.userId,
        holdHours,
        expiresAt,
      },
    });
    await this.prisma.unit.update({ where: { id: input.unitId }, data: { state: "held" } });
    await this.audit(input.tenantId, input.userId, "sales.hold.created", hold.id, { unitId: input.unitId, expiresAt });
    return { holdId: hold.id, expiresAt };
  }

  async submitBooking(input: SubmitBookingInput): Promise<{ bookingId: string; status: string; workflowId?: string }> {
    const hold = await this.prisma.hold.findFirst({
      where: { id: input.holdId, tenantId: input.tenantId, status: "active" },
    });
    if (!hold || hold.expiresAt.getTime() < Date.now()) {
      throw new RangeError("hold missing or expired — create a fresh hold");
    }
    const total = Money.fromPaise(input.totalPaise);
    const discountPaise = input.discountPct > 0 ? total.percent(input.discountPct) : Money.zero();

    let workflowId: string | undefined;
    const status = input.discountPct > 0 ? "pending_approval" : "draft";
    if (input.discountPct > 0) {
      const wf = await this.workflow.start({
        tenantId: input.tenantId,
        action: "sales.discount",
        valuePaise: discountPaise.paise,
        payload: { unitId: input.unitId, discountPct: input.discountPct },
        initiatorUserId: input.initiatorUserId,
      });
      workflowId = wf.instanceId;
    }

    const booking = await this.prisma.booking.create({
      data: {
        tenantId: input.tenantId,
        unitId: input.unitId,
        holdId: input.holdId,
        leadId: input.leadId,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        coApplicants: (input.coApplicants ?? []) as object,
        kyc: (input.kyc ?? {}) as object,
        planCode: input.planCode,
        priceSnapshot: { totalPaise: input.totalPaise.toString(), discountPct: input.discountPct },
        totalPaise: input.totalPaise,
        discountPct: input.discountPct,
        discountPaise: discountPaise.paise,
        workflowId,
        status,
        aftStatus: "not_started",
      },
    });
    await this.audit(input.tenantId, input.initiatorUserId, "sales.booking.submitted", booking.id, {
      unitId: input.unitId,
      discountPct: input.discountPct,
      workflowId,
    });
    return { bookingId: booking.id, status, workflowId };
  }

  async confirmBooking(tenantId: string, bookingId: string, actorUserId: string): Promise<unknown> {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) throw new NotFoundException("booking not found");

    if (booking.status === "pending_approval") {
      const wf = booking.workflowId
        ? await this.prisma.workflowInstance.findUnique({ where: { id: booking.workflowId } })
        : null;
      if (!wf || wf.state !== "approved") {
        throw new RangeError("discount approval pending — booking cannot be confirmed");
      }
    } else if (booking.status !== "draft") {
      throw new RangeError(`booking is ${booking.status}`);
    }

    const unit = await this.prisma.unit.findFirst({ where: { id: booking.unitId, tenantId } });
    if (!unit) throw new NotFoundException("unit not found");
    assertTransition(unit.state as UnitState, "booked");

    const total = Money.fromPaise(booking.totalPaise).sub(Money.fromPaise(booking.discountPaise));
    const milestones = (
      await this.prisma.paymentPlanTemplate.findFirst({
        where: { tenantId, code: booking.planCode },
      })
    )?.milestones as unknown as PlanMilestone[] | undefined;
    const milestonesToUse = milestones ?? this.fallbackMilestones(booking.planCode);
    const bookingDate = new Date();
    const schedule = generateSchedule({
      planType: "CLP",
      milestones: milestonesToUse,
      total,
      bookingDate,
    });
    // JSON-safe snapshot (Money serializes via toJSON; paise must stay explicit)
    const scheduleSnapshot = schedule.map((s) => ({
      seq: s.seq,
      key: s.key,
      label: s.label,
      amountPaise: s.amount.paise.toString(),
      dueDate: s.dueDate,
      trigger: s.trigger,
    }));

    await this.prisma.unit.update({ where: { id: unit.id }, data: { state: "booked" } });
    if (booking.holdId) {
      await this.prisma.hold.update({ where: { id: booking.holdId }, data: { status: "converted" } });
    }
    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "confirmed",
        bookingDate,
        scheduleSnapshot: scheduleSnapshot as unknown as object,
      },
    });
    await this.prisma.outboxEvent.create({
      data: {
        tenantId,
        aggregate: "booking",
        type: "booking.confirmed.v1",
        payload: { bookingId: booking.id, unitId: unit.id, totalPaise: total.paise.toString() },
      },
    });
    await this.audit(tenantId, actorUserId, "sales.booking.confirmed", booking.id, { unitId: unit.id });
    // Welcome journey (consent/quiet-hours enforced in the hub)
    await this.notify.triggerJourney(tenantId, "booking_welcome", booking.customerPhone, {
      bookingId: booking.id,
      name: booking.customerName,
      toAddress: booking.customerPhone,
    });
    return { bookingId: booking.id, status: "confirmed", totalPaise: total.paise.toString() };
  }

  async cancelBooking(
    tenantId: string,
    bookingId: string,
    actorUserId: string,
    input: { initiator: CancelInitiator; stage: "pre_aft" | "post_aft" | "post_possession"; paidPaise: bigint; builderDelayDays?: number },
  ): Promise<unknown> {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking || booking.status !== "confirmed") throw new NotFoundException("confirmed booking not found");

    const outcome = computeCancellation(input);
    const unit = await this.prisma.unit.findFirst({ where: { id: booking.unitId, tenantId } });
    if (!unit) throw new NotFoundException("unit not found");
    assertTransition(unit.state as UnitState, "cancelled");
    assertTransition("cancelled", "available");

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: `${input.initiator}/${input.stage}`,
        forfeitPaise: outcome.forfeit.paise,
        refundPaise: outcome.refund.paise,
      },
    });
    await this.prisma.unit.update({ where: { id: unit.id }, data: { state: "available" } });
    await this.prisma.outboxEvent.create({
      data: {
        tenantId,
        aggregate: "unit",
        type: "unit.cancelled.v1",
        payload: {
          bookingId: booking.id,
          unitId: unit.id,
          forfeitPaise: outcome.forfeit.paise.toString(),
          refundPaise: outcome.refund.paise.toString(),
          clawback: true, // commission engine reverses accrued commissions
        },
      },
    });
    await this.audit(tenantId, actorUserId, "sales.booking.cancelled", booking.id, {
      notes: outcome.notes,
      refund: outcome.refund.formatIndian(),
    });
    return {
      bookingId: booking.id,
      status: "cancelled",
      forfeitPaise: outcome.forfeit.paise.toString(),
      interestPaise: outcome.interest.paise.toString(),
      refundPaise: outcome.refund.paise.toString(),
      notes: outcome.notes,
    };
  }

  /** AFT status progression until the eSign adapter lands (integrations phase). */
  async advanceAft(tenantId: string, bookingId: string, to: "draft" | "sent" | "signed" | "registered"): Promise<unknown> {
    const order = ["not_started", "draft", "sent", "signed", "registered"] as const;
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking) throw new NotFoundException("booking not found");
    const from = order.indexOf(booking.aftStatus as (typeof order)[number]);
    const toIdx = order.indexOf(to);
    if (toIdx !== from + 1) throw new RangeError(`illegal AFT transition: ${booking.aftStatus} → ${to}`);
    await this.prisma.booking.update({ where: { id: booking.id }, data: { aftStatus: to } });
    await this.audit(tenantId, "system", `sales.aft.${to}`, booking.id, {});
    return { bookingId: booking.id, aftStatus: to };
  }

  private fallbackMilestones(planCode: string): PlanMilestone[] {
    if (planCode.startsWith("DPLP")) {
      return [
        { key: "booking", label: "Down payment", percent: 20, trigger: { kind: "on_booking" } },
        { key: "possession", label: "On possession", percent: 80, trigger: { kind: "construction_milestone", milestoneKey: "possession" } },
      ];
    }
    return [
      { key: "booking", label: "Booking amount", percent: 10, trigger: { kind: "on_booking" } },
      { key: "possession", label: "On possession", percent: 90, trigger: { kind: "construction_milestone", milestoneKey: "possession" } },
    ];
  }

  private async audit(tenantId: string, userId: string, action: string, entityId: string, detail: Record<string, unknown>): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId: userId,
        actorKind: "human",
        action,
        entityType: "booking",
        entityId,
        after: detail as object,
      },
    });
  }
}
