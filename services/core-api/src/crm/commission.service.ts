import { Injectable, NotFoundException } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { accrueCommission, creditDecision, tdsOnCommission, type CommissionPlanShape } from "./commission.js";

/**
 * Commission engine (WP-1E): accrual on realized receipts (BR-H), reversal on
 * cancellation (clawback flag from unit.cancelled.v1), TDS 194H payout batches
 * with maker-checker approval.
 */
@Injectable()
export class CommissionService {
  constructor(private readonly prisma: PrismaService) {}

  /** receipt.cleared.v1 consumer: accrue for the booking's credited partner. */
  async onReceiptCleared(
    tenantId: string,
    bookingId: string,
    receiptPaise: bigint,
  ): Promise<{ accrued: boolean; amountPaise?: string; reason?: string }> {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, tenantId } });
    if (!booking?.leadId) return { accrued: false, reason: "no lead attribution" };

    const lead = await this.prisma.lead.findFirst({ where: { id: booking.leadId, tenantId } });
    if (!lead || lead.source !== "partner" || !lead.sourceRef) {
      return { accrued: false, reason: "not partner-attributed" };
    }
    const partner = await this.prisma.channelPartner.findFirst({
      where: { tenantId, id: lead.sourceRef, status: "active" },
    });
    if (!partner) return { accrued: false, reason: "partner not active" };

    const panel = await this.prisma.partnerPanel.findFirst({
      where: { tenantId, partnerId: partner.id, projectId: booking.projectId ?? undefined, active: true },
    });
    if (!panel) return { accrued: false, reason: "partner not on project panel" };

    const plan = (await this.prisma.commissionPlan.findFirst({
      where: { tenantId, active: true },
    })) as unknown as CommissionPlanShape | null;
    if (!plan) return { accrued: false, reason: "no active commission plan" };

    const amount = accrueCommission(plan, Money.fromPaise(receiptPaise));
    await this.prisma.commissionLedgerEntry.create({
      data: {
        tenantId,
        partnerId: partner.id,
        bookingId,
        projectId: booking.projectId,
        accruedPaise: amount.paise,
        sourceEvent: "receipt.cleared.v1",
      },
    });
    return { accrued: true, amountPaise: amount.paise.toString() };
  }

  /** unit.cancelled.v1 consumer (clawback flag): reverse open accrued entries. */
  async onBookingCancelled(tenantId: string, bookingId: string): Promise<{ reversedPaise: string; entries: number }> {
    const entries = await this.prisma.commissionLedgerEntry.findMany({
      where: { tenantId, bookingId, status: "accrued" },
    });
    let reversed = Money.zero();
    for (const e of entries) {
      await this.prisma.commissionLedgerEntry.update({
        where: { id: e.id },
        data: { status: "reversed", reversedPaise: e.accruedPaise },
      });
      reversed = reversed.add(Money.fromPaise(e.accruedPaise));
    }
    return { reversedPaise: reversed.paise.toString(), entries: entries.length };
  }

  /** RERA agent-registration gate: partner must hold a valid agent number for panels. */
  async addToPanel(
    tenantId: string,
    partnerId: string,
    projectId: string,
    actorUserId: string,
  ): Promise<{ panelId: string }> {
    const partner = await this.prisma.channelPartner.findFirst({ where: { id: partnerId, tenantId } });
    if (!partner) throw new NotFoundException("partner not found");
    if (partner.status !== "active") throw new RangeError("partner is not active");
    if (!partner.reraAgentNo || (partner.reraAgentExpiry && partner.reraAgentExpiry.getTime() < Date.now())) {
      throw new RangeError("valid RERA agent registration required (BR-C gate)");
    }
    const panel = await this.prisma.partnerPanel.create({
      data: { tenantId, partnerId, projectId, active: true },
    });
    return { panelId: panel.id };
  }

  /** Payout draft: open accrued entries → gross, TDS 194H, net (maker). */
  async createPayout(tenantId: string, partnerId: string, plan: CommissionPlanShape): Promise<unknown> {
    const entries = await this.prisma.commissionLedgerEntry.findMany({
      where: { tenantId, partnerId, status: "accrued" },
    });
    if (entries.length === 0) throw new RangeError("no accrued commissions to pay");
    const gross = Money.sum(entries.map((e) => Money.fromPaise(e.accruedPaise)));
    const tds = tdsOnCommission(gross, plan.tdsBps);
    const net = gross.sub(tds);
    const batch = await this.prisma.payoutBatch.create({
      data: {
        tenantId,
        partnerId,
        status: "draft",
        entryIds: entries.map((e) => e.id),
        grossPaise: gross.paise,
        tdsPaise: tds.paise,
        netPaise: net.paise,
      },
    });
    return batch;
  }

  /** Approve payout (checker) — marks entries paid. SoD: creator ≠ approver (enforced at API layer). */
  async approvePayout(tenantId: string, batchId: string, approverUserId: string): Promise<unknown> {
    const batch = await this.prisma.payoutBatch.findFirst({ where: { id: batchId, tenantId } });
    if (!batch) throw new NotFoundException("payout batch not found");
    if (batch.status !== "draft") throw new RangeError(`batch is ${batch.status}`);
    await this.prisma.payoutBatch.update({
      where: { id: batchId },
      data: { status: "approved", approvedBy: approverUserId },
    });
    for (const entryId of batch.entryIds) {
      await this.prisma.commissionLedgerEntry.update({ where: { id: entryId }, data: { status: "paid" } });
    }
    return { batchId, status: "approved" };
  }

  /** Partner lead-import credit decision (BR-3C). */
  creditFor(leadCreatedAt: Date, partnerImportedAt: Date, houseLeadCreatedAt: Date | null, windowDays: number) {
    return creditDecision({ leadCreatedAt, partnerImportedAt, houseLeadCreatedAt, windowDays });
  }
}
