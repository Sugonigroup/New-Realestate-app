import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { evaluateWithdrawal, classifyReceipt, type EscrowState } from "./escrow.js";

/**
 * Escrow service (WP-2C): classification of cleared receipts into the designated
 * account, guarded withdrawal requests (Form 3/4 certificates mandatory), and
 * breach scanning feeding compliance + exec dashboards (D8).
 */
@Injectable()
export class EscrowService {
  constructor(private readonly prisma: PrismaService) {}

  /** receipt.cleared.v1 consumer: classify into the 70% bucket. */
  async onReceiptCleared(tenantId: string, projectId: string, amountPaise: bigint): Promise<void> {
    const account = await this.prisma.escrowAccount.findFirst({
      where: { tenantId, projectId },
    });
    if (!account) return; // project without a designated account → setup task elsewhere
    const classification = classifyReceipt(account.collectedPaise + amountPaise);
    await this.prisma.escrowAccount.update({
      where: { id: account.id },
      data: { collectedPaise: account.collectedPaise + amountPaise },
    });
    void classification; // projection helper; parked share is derived, not stored twice
  }

  /** Withdrawal request: guard evaluation + Form 3/4 certificates mandatory (12 §4). */
  async requestWithdrawal(
    tenantId: string,
    projectId: string,
    input: { amountPaise: bigint; requestedBy: string; form3Ref?: string; form4Ref?: string; certifiedPct?: number },
  ): Promise<{ withdrawalId: string; guard: unknown }> {
    const account = await this.prisma.escrowAccount.findFirst({ where: { tenantId, projectId } });
    if (!account) throw new NotFoundException("escrow account not configured for project");

    if (!input.form3Ref || !input.form4Ref) {
      throw new RangeError("Form 3 (engineer) and Form 4 (architect/CA) certificates are mandatory for withdrawal");
    }
    const certifiedPct = input.certifiedPct ?? Number(account.certifiedPct);
    const state: EscrowState = {
      collectedPaise: account.collectedPaise,
      withdrawnPaise: account.withdrawnPaise,
      certifiedPct,
      totalProjectCostPaise: account.totalProjectCostPaise,
    };
    const guard = evaluateWithdrawal(state, input.amountPaise);
    if (!guard.allowed) throw new RangeError(guard.reason);

    const w = await this.prisma.escrowWithdrawal.create({
      data: {
        tenantId,
        escrowAccountId: account.id,
        amountPaise: input.amountPaise,
        certifiedPct,
        form3Ref: input.form3Ref,
        form4Ref: input.form4Ref,
        status: "requested",
        requestedBy: input.requestedBy,
      },
    });
    return { withdrawalId: w.id, guard };
  }

  /** Approve (CFO/MD per authority matrix) — updates account counters. */
  async approveWithdrawal(tenantId: string, withdrawalId: string, approverUserId: string): Promise<unknown> {
    const w = await this.prisma.escrowWithdrawal.findFirst({ where: { id: withdrawalId, tenantId } });
    if (!w || w.status !== "requested") throw new NotFoundException("requested withdrawal not found");
    const account = await this.prisma.escrowAccount.findFirst({ where: { id: w.escrowAccountId, tenantId } });
    if (!account) throw new NotFoundException("escrow account missing");

    // Re-evaluate at approval time (certified % may have moved)
    const guard = evaluateWithdrawal(
      { collectedPaise: account.collectedPaise, withdrawnPaise: account.withdrawnPaise, certifiedPct: Number(w.certifiedPct), totalProjectCostPaise: account.totalProjectCostPaise },
      w.amountPaise,
    );
    if (!guard.allowed) throw new RangeError(guard.reason);

    await this.prisma.escrowWithdrawal.update({
      where: { id: w.id },
      data: { status: "approved", approvedBy: approverUserId },
    });
    await this.prisma.escrowAccount.update({
      where: { id: account.id },
      data: { withdrawnPaise: account.withdrawnPaise + w.amountPaise, certifiedPct: w.certifiedPct },
    });
    return { withdrawalId: w.id, status: "approved" };
  }

  /** Daily breach scan: any project where withdrawn > parked-required → breach event. */
  async scanBreaches(tenantId: string): Promise<Array<{ projectId: string; withdrawnPaise: string; parkedRequiredPaise: string }>> {
    const accounts = await this.prisma.escrowAccount.findMany({ where: { tenantId } });
    const breaches: Array<{ projectId: string; withdrawnPaise: string; parkedRequiredPaise: string }> = [];
    for (const account of accounts) {
      const guard = evaluateWithdrawal(
        {
          collectedPaise: account.collectedPaise,
          withdrawnPaise: account.withdrawnPaise,
          certifiedPct: Number(account.certifiedPct),
          totalProjectCostPaise: account.totalProjectCostPaise,
        },
        0n,
      );
      if (guard.breach) {
        breaches.push({
          projectId: account.projectId,
          withdrawnPaise: account.withdrawnPaise.toString(),
          parkedRequiredPaise: guard.parkedRequiredPaise.toString(),
        });
        await this.prisma.outboxEvent.create({
          data: {
            tenantId,
            aggregate: "escrow",
            type: "escrow.breach.v1",
            payload: { projectId: account.projectId, ...breaches[breaches.length - 1] },
          },
        });
      }
    }
    return breaches;
  }

  /** Dashboard payload (D2/D8 escrow panel). */
  async summary(tenantId: string, projectId: string): Promise<unknown> {
    const account = await this.prisma.escrowAccount.findFirst({ where: { tenantId, projectId } });
    if (!account) throw new NotFoundException("escrow account not configured");
    const guard = evaluateWithdrawal(
      {
        collectedPaise: account.collectedPaise,
        withdrawnPaise: account.withdrawnPaise,
        certifiedPct: Number(account.certifiedPct),
        totalProjectCostPaise: account.totalProjectCostPaise,
      },
      0n,
    );
    return {
      collectedPaise: account.collectedPaise.toString(),
      withdrawnPaise: account.withdrawnPaise.toString(),
      parkedRequiredPaise: guard.parkedRequiredPaise.toString(),
      withdrawnCapPaise: guard.withdrawnCapPaise.toString(),
      maxAdditionalPaise: guard.maxAdditionalPaise.toString(),
      breach: guard.breach,
      utilisationPct: account.collectedPaise > 0n
        ? Number((account.withdrawnPaise * 10000n) / account.collectedPaise) / 100
        : 0,
    };
  }
}
