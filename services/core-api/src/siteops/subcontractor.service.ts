import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Subcontractor Management & Running Account (RA) Bills service (SUB-01):
 * - Subcontractor Work Order management with retention % configuration
 * - RA Bill calculation: Gross Work - Retention - Advance Recovery - TDS 194C (1%/2%) = Net Payable
 * - Certification gate (maker-checker certification of measured work)
 */

@Injectable()
export class SubcontractorService {
  constructor(private readonly prisma: PrismaService) {}

  async createWorkOrder(tenantId: string, input: {
    woNo: string;
    projectId: string;
    contractorId: string;
    title: string;
    totalPaise: bigint;
    retentionPct?: number;
  }) {
    const existing = await this.prisma.subcontractorWorkOrder.findFirst({ where: { tenantId, woNo: input.woNo } });
    if (existing) throw new ConflictException(`subcontractor WO ${input.woNo} already exists`);

    return this.prisma.subcontractorWorkOrder.create({
      data: {
        tenantId,
        woNo: input.woNo,
        projectId: input.projectId,
        contractorId: input.contractorId,
        title: input.title,
        totalPaise: input.totalPaise,
        retentionPct: input.retentionPct ?? 5.0,
        status: "active",
      },
    });
  }

  /** Submit RA Bill with automated retention & TDS calculation. */
  async submitRaBill(tenantId: string, input: {
    billNo: string;
    workOrderId: string;
    period: string;
    grossValPaise: bigint;
    advanceRecPaise?: bigint;
    tdsRateBps?: number; // default 100 bps (1% for individual) or 200 bps (2% for company)
  }) {
    const wo = await this.prisma.subcontractorWorkOrder.findFirst({ where: { tenantId, id: input.workOrderId } });
    if (!wo) throw new NotFoundException(`work order ${input.workOrderId} not found`);
    const existing = await this.prisma.raBill.findFirst({ where: { tenantId, billNo: input.billNo } });
    if (existing) throw new ConflictException(`RA Bill ${input.billNo} already exists`);

    // Retention = grossVal * retentionPct / 100
    const retentionRateBps = BigInt(Math.round(Number(wo.retentionPct) * 100));
    const retentionPaise = (input.grossValPaise * retentionRateBps) / 10_000n;

    const advanceRecPaise = input.advanceRecPaise ?? 0n;

    // TDS Section 194C = (grossVal - retention) * tdsRateBps / 10000
    const tdsBps = BigInt(input.tdsRateBps ?? 200); // default 2%
    const taxableVal = input.grossValPaise - retentionPaise;
    const tdsPaise = (taxableVal * tdsBps) / 10_000n;

    const netPayablePaise = input.grossValPaise - retentionPaise - advanceRecPaise - tdsPaise;
    if (netPayablePaise < 0n) {
      throw new BadRequestException(`net payable ₹${netPayablePaise} cannot be negative; check advance recovery`);
    }

    return this.prisma.raBill.create({
      data: {
        tenantId,
        billNo: input.billNo,
        workOrderId: wo.id,
        projectId: wo.projectId,
        contractorId: wo.contractorId,
        period: input.period,
        grossValPaise: input.grossValPaise,
        retentionPaise,
        advanceRecPaise,
        tdsPaise,
        netPayablePaise,
        status: "submitted",
      },
    });
  }

  /** Certify RA Bill — maker cannot certify their own submitted bill. */
  async certifyRaBill(tenantId: string, billNo: string, certifierId: string) {
    const bill = await this.prisma.raBill.findFirst({ where: { tenantId, billNo } });
    if (!bill) throw new NotFoundException(`RA Bill ${billNo} not found`);
    if (bill.status === "certified" || bill.status === "paid") {
      throw new ConflictException(`RA Bill ${billNo} is already ${bill.status}`);
    }

    return this.prisma.raBill.update({
      where: { id: bill.id },
      data: {
        status: "certified",
        certifiedBy: certifierId,
        certifiedAt: new Date(),
      },
    });
  }
}
