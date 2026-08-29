import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { allocateFifo, type OpenDemand } from "./allocation.js";
import { computeInterest } from "./interest.js";
import { evaluateDunning, type DunningStep } from "./dunning.js";
import { validateInstrument, BOUNCE_CHARGE_PAISE, type Instrument } from "./instruments.js";
import type { ScheduleItem } from "../sales/schedule.js";

export interface GenerateDemandsInput {
  tenantId: string;
  bookingId: string;
  entityId: string;
  schedule: Array<ScheduleItem & { amountPaise?: string }>;
  certifiedMilestones?: string[];
}

/**
 * Demand engine (WP-2A): from the booking's immutable schedule snapshot, create
 * demands for (a) date-arrived day-offset items and (b) certified construction
 * milestones. Gapless numbering via number_series (BR-L). The schedule's
 * amountPaise is authoritative (exact-paise snapshot from booking confirm).
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async generateDemandsForBooking(input: GenerateDemandsInput): Promise<{ created: string[]; skipped: Array<{ key: string; reason: string }> }> {
    const booking = await this.prisma.booking.findFirst({ where: { id: input.bookingId, tenantId: input.tenantId } });
    if (!booking) throw new NotFoundException("booking not found");

    const created: string[] = [];
    const skipped: Array<{ key: string; reason: string }> = [];
    const seriesKey = "demand";
    const items = input.schedule;

    for (const item of items) {
      const existing = await this.prisma.demand.findFirst({
        where: { tenantId: input.tenantId, bookingId: input.bookingId, scheduleKey: item.key },
      });
      if (existing) {
        skipped.push({ key: item.key, reason: "already generated" });
        continue;
      }
      const amountPaise = BigInt(item.amountPaise ?? item.amount.paise.toString());
      const now = new Date();
      const dateArrived = item.dueDate !== null && item.dueDate.getTime() <= now.getTime();
      const milestoneCertified =
        item.trigger.kind === "construction_milestone" &&
        (input.certifiedMilestones?.includes(item.trigger.milestoneKey) ?? false);
      if (!dateArrived && !milestoneCertified) {
        skipped.push({ key: item.key, reason: "not yet due (date pending / milestone not certified)" });
        continue;
      }

      const series = await this.prisma.numberSeries.upsert({
        where: { tenantId_entityId_seriesKey: { tenantId: input.tenantId, entityId: input.entityId, seriesKey } },
        update: { nextNo: { increment: 1 } },
        create: { tenantId: input.tenantId, entityId: input.entityId, seriesKey, prefix: "DMND" },
      });
      const demandNo = `${series.prefix}-${String(series.nextNo).padStart(6, "0")}`;

      const demand = await this.prisma.demand.create({
        data: {
          tenantId: input.tenantId,
          bookingId: input.bookingId,
          unitId: booking.unitId,
          entityId: input.entityId,
          seq: item.seq,
          demandNo,
          scheduleKey: item.key,
          label: item.label,
          amountPaise,
          dueDate: item.dueDate,
          status: "due",
        },
      });
      await this.prisma.customerLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          unitId: booking.unitId,
          bookingId: input.bookingId,
          entryType: "demand",
          refId: demand.id,
          debitPaise: amountPaise,
          creditPaise: 0n,
        },
      });
      created.push(demand.id);
    }
    return { created, skipped };
  }

  /** Apply a receipt: instrument validation (BR-K), FIFO allocation, ledger, event. */
  async applyReceipt(input: {
    tenantId: string;
    bookingId: string;
    unitId: string;
    amountPaise: bigint;
    instrument: Instrument;
    instrumentRef?: string;
    gatewayRef?: string;
  }): Promise<{ receiptId: string; status: string; allocations: Array<{ demandId: string; amountPaise: string }> }> {
    const amount = Money.fromPaise(input.amountPaise);
    const validation = validateInstrument(input.instrument, amount, input.instrumentRef);
    if (!validation.ok) throw new BadRequestException({ title: validation.reason });

    // Gateway idempotency: same instrumentRef must never double-receipt
    if (input.instrumentRef) {
      const dup = await this.prisma.receipt.findFirst({
        where: { tenantId: input.tenantId, instrumentRef: input.instrumentRef },
      });
      if (dup) throw new BadRequestException({ title: "duplicate instrument reference" });
    }

    const openDemands = (await this.prisma.demand.findMany({
      where: { tenantId: input.tenantId, bookingId: input.bookingId, status: { in: ["due", "reminded", "part_paid", "overdue"] } },
    })) as unknown as OpenDemand[];
    const { allocations, unallocated } = allocateFifo(openDemands, amount);

    const receipt = await this.prisma.receipt.create({
      data: {
        tenantId: input.tenantId,
        bookingId: input.bookingId,
        unitId: input.unitId,
        amountPaise: input.amountPaise,
        instrument: input.instrument,
        instrumentRef: input.instrumentRef,
        gatewayRef: input.gatewayRef,
        status: "cleared",
        clearedAt: new Date(),
        allocations: allocations as object,
      },
    });

    for (const alloc of allocations) {
      const demand = openDemands.find((d) => d.id === alloc.demandId)!;
      const newPaid = demand.paidPaise + alloc.amountPaise;
      const fully = newPaid >= demand.amountPaise;
      await this.prisma.demand.update({
        where: { id: demand.id },
        data: { paidPaise: newPaid, status: fully ? "paid" : "part_paid" },
      });
      await this.prisma.customerLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          unitId: input.unitId,
          bookingId: input.bookingId,
          entryType: "receipt",
          refId: receipt.id,
          debitPaise: 0n,
          creditPaise: alloc.amountPaise,
        },
      });
    }

    await this.prisma.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        aggregate: "receipt",
        type: "receipt.cleared.v1",
        payload: {
          receiptId: receipt.id,
          bookingId: input.bookingId,
          amountPaise: input.amountPaise.toString(),
          unallocatedPaise: unallocated.paise.toString(),
        },
      },
    });
    return {
      receiptId: receipt.id,
      status: "cleared",
      allocations: allocations.map((a) => ({ demandId: a.demandId, amountPaise: a.amountPaise.toString() })),
    };
  }

  /** Bounce workflow: receipt → bounced, charges debited, demands reopen implicitly. */
  async bounceReceipt(tenantId: string, receiptId: string, actorUserId: string): Promise<unknown> {
    const receipt = await this.prisma.receipt.findFirst({ where: { id: receiptId, tenantId } });
    if (!receipt || receipt.status !== "cleared") throw new NotFoundException("cleared receipt not found");

    const allocations = (receipt.allocations ?? []) as Array<{ demandId: string; amountPaise: string }>;
    for (const alloc of allocations) {
      const demand = await this.prisma.demand.findFirst({ where: { id: alloc.demandId, tenantId } });
      if (!demand) continue;
      const newPaid = demand.paidPaise - BigInt(alloc.amountPaise);
      await this.prisma.demand.update({
        where: { id: demand.id },
        data: { paidPaise: newPaid > 0n ? newPaid : 0n, status: newPaid > 0n ? "part_paid" : "overdue" },
      });
      await this.prisma.customerLedgerEntry.create({
        data: {
          tenantId, unitId: receipt.unitId, bookingId: receipt.bookingId,
          entryType: "bounce_charge", refId: receipt.id,
          debitPaise: BOUNCE_CHARGE_PAISE, creditPaise: 0n,
        },
      });
    }
    await this.prisma.receipt.update({
      where: { id: receipt.id },
      data: { status: "bounced", bouncedAt: new Date(), bounceChargesPaise: BOUNCE_CHARGE_PAISE },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId, actorUserId, actorKind: "human",
        action: "finance.receipt.bounced",
        entityType: "receipt", entityId: receipt.id,
        after: { charges: BOUNCE_CHARGE_PAISE.toString() },
      },
    });
    return { receiptId: receipt.id, status: "bounced", chargesPaise: BOUNCE_CHARGE_PAISE.toString() };
  }

  /** Interest posting + dunning evaluation for one demand (jobs call per demand). */
  async evaluateDemand(tenantId: string, demandId: string, asOf: Date, interestRateBps = 1025, capBps = 1200): Promise<unknown> {
    const demand = (await this.prisma.demand.findFirst({ where: { id: demandId, tenantId } })) as unknown as OpenDemand & { lastDunningStep?: string | null; label: string; demandNo: string };
    if (!demand) throw new NotFoundException("demand not found");

    const interest = computeInterest({ demand, rateBps: interestRateBps, capBps, asOf });
    const dunning = evaluateDunning({ dueDate: demand.dueDate, lastDunningStep: demand.lastDunningStep }, asOf);
    const status = demand.status === "paid" || demand.status === "part_paid" ? demand.status : interest.daysLate > 0 ? "overdue" : demand.status;

    await this.prisma.demand.update({
      where: { id: demandId },
      data: {
        status,
        interestPaise: interest.interest.paise,
        lastDunningStep: dunning.dueSteps.at(-1) ?? demand.lastDunningStep,
      },
    });
    return {
      demandNo: demand.demandNo,
      interestPaise: interest.interest.paise.toString(),
      daysLate: interest.daysLate,
      dunningStepsDue: dunning.dueSteps,
      status,
    };
  }
}
