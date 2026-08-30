import { Injectable } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { verifyBill } from "../ai/agents/billing-verification.js";

/** Procurement service (U3): RA bill submission with AI 3-way-match verification (08 #7). */
@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  async submitRaBill(
    tenantId: string,
    input: {
      projectId: string;
      contractorId: string;
      billNo: string;
      billQty: number;
      billRatePaise: bigint;
      mbQty: number;
      boqQty: number;
      boqRatePaise: bigint;
      cumulativeBilledQty: number;
      soeQty: number;
    },
  ): Promise<unknown> {
    const prior = (await this.prisma.raBill.findMany({
      where: { tenantId, projectId: input.projectId, contractorId: input.contractorId },
    })) as unknown as Array<{ mbQty: number }>;
    const priorMbHashes = prior.map((p) => `${p.mbQty}:${input.boqQty}`);
    const mbHash = `${input.mbQty}:${input.boqQty}`;
    const cumulativeBilledQty = input.cumulativeBilledQty;

    const verification = verifyBill({
      billQty: input.billQty,
      billRatePaise: input.billRatePaise,
      mbQty: input.mbQty,
      boqQty: input.boqQty,
      boqRatePaise: input.boqRatePaise,
      cumulativeBilledQty,
      soeQty: input.soeQty,
      mbHashes: [mbHash],
      priorMbHashes,
    });

    const bill = await this.prisma.raBill.create({
      data: {
        tenantId,
        projectId: input.projectId,
        contractorId: input.contractorId,
        billNo: input.billNo,
        billQty: input.billQty,
        billRatePaise: input.billRatePaise,
        mbQty: input.mbQty,
        boqQty: input.boqQty,
        boqRatePaise: input.boqRatePaise,
        cumulativeBilledQty,
        soeQty: input.soeQty,
        status: "verified",
        anomalies: verification.anomalies as unknown as object,
        recommendation: verification.recommendation,
      },
    });

    // Audit the AI verification decision
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorKind: "ai_agent",
        action: "procurement.rabill.verified",
        entityType: "ra_bill",
        entityId: bill.id,
        after: { recommendation: verification.recommendation, anomalies: verification.anomalies.length },
      },
    });
    return { billId: bill.id, ...verification };
  }

  async listRaBills(tenantId: string, projectId?: string): Promise<unknown[]> {
    return this.prisma.raBill.findMany({
      where: { tenantId, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  /** Bill value helper for the UI. */
  billValue(billQty: number, ratePaise: bigint): string {
    return Money.fromPaise(ratePaise).multiply(String(billQty)).formatIndian();
  }
}
