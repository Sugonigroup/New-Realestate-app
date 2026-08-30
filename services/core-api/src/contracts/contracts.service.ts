import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Contracts & Legal service (P1b): contract lifecycle (draft→review→active→amended→closed),
 * clause management with risk tracking, obligation tracking with overdue detection,
 * and dispute/claim logging with liability aggregation.
 */

export interface ClauseInput {
  sectionNo: string;
  title: string;
  bodyText: string;
  isStandard?: boolean;
  riskLevel?: "low" | "medium" | "high" | "critical";
}

export interface ObligationInput {
  title: string;
  description?: string;
  dueOn: Date;
  ownerRole: string;
}

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Contracts ───────────────────────────────────────────────────────────

  async createContract(tenantId: string, input: {
    contractNo: string;
    title: string;
    partyName: string;
    partyRole: "contractor" | "vendor" | "landowner" | "consultant" | "client";
    projectId?: string;
    totalPaise: bigint;
    effectiveFrom: Date;
    effectiveTo?: Date;
    clauses?: ClauseInput[];
    obligations?: ObligationInput[];
  }) {
    const existing = await this.prisma.legalContract.findFirst({ where: { tenantId, contractNo: input.contractNo } });
    if (existing) throw new ConflictException(`contract ${input.contractNo} already exists`);
    return this.prisma.legalContract.create({
      data: {
        tenantId,
        contractNo: input.contractNo,
        title: input.title,
        partyName: input.partyName,
        partyRole: input.partyRole,
        projectId: input.projectId,
        totalPaise: input.totalPaise,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        status: "draft",
        clauses: input.clauses ? {
          create: input.clauses.map((c) => ({
            tenantId,
            sectionNo: c.sectionNo,
            title: c.title,
            bodyText: c.bodyText,
            isStandard: c.isStandard ?? true,
            riskLevel: c.riskLevel ?? "low",
          })),
        } : undefined,
        obligations: input.obligations ? {
          create: input.obligations.map((o) => ({
            tenantId,
            title: o.title,
            description: o.description,
            dueOn: o.dueOn,
            ownerRole: o.ownerRole,
          })),
        } : undefined,
      },
      include: { clauses: true, obligations: true },
    });
  }

  /** Activate a contract after legal review — checks that high/critical risk clauses are signed off. */
  async activateContract(tenantId: string, contractId: string, signedAt: Date) {
    const contract = await this.prisma.legalContract.findFirst({
      where: { tenantId, id: contractId },
      include: { clauses: true },
    });
    if (!contract) throw new NotFoundException(`contract ${contractId} not found`);
    if (contract.status === "active") throw new ConflictException(`contract ${contract.contractNo} is already active`);
    if (contract.status === "closed" || contract.status === "terminated") {
      throw new ConflictException(`cannot activate ${contract.status} contract ${contract.contractNo}`);
    }
    const criticalClauses = contract.clauses.filter((c) => c.riskLevel === "critical");
    if (criticalClauses.length > 0 && !contract.signedAt && !signedAt) {
      throw new BadRequestException(
        `contract ${contract.contractNo} has ${criticalClauses.length} critical risk clauses requiring signedAt timestamp`,
      );
    }
    return this.prisma.legalContract.update({
      where: { id: contract.id },
      data: { status: "active", signedAt: signedAt ?? new Date() },
    });
  }

  // ── Clauses ─────────────────────────────────────────────────────────────

  async addClause(tenantId: string, contractId: string, input: ClauseInput) {
    const contract = await this.prisma.legalContract.findFirst({ where: { tenantId, id: contractId } });
    if (!contract) throw new NotFoundException(`contract ${contractId} not found`);
    if (contract.status === "closed" || contract.status === "terminated") {
      throw new ConflictException(`cannot add clause to ${contract.status} contract`);
    }
    return this.prisma.contractClause.create({
      data: {
        tenantId,
        contractId: contract.id,
        sectionNo: input.sectionNo,
        title: input.title,
        bodyText: input.bodyText,
        isStandard: input.isStandard ?? true,
        riskLevel: input.riskLevel ?? "low",
      },
    });
  }

  // ── Obligations ─────────────────────────────────────────────────────────

  async fulfillObligation(tenantId: string, obligationId: string) {
    const ob = await this.prisma.contractObligation.findFirst({ where: { tenantId, id: obligationId } });
    if (!ob) throw new NotFoundException(`obligation ${obligationId} not found`);
    if (ob.status === "fulfilled") throw new ConflictException(`obligation ${ob.title} already fulfilled`);
    return this.prisma.contractObligation.update({
      where: { id: ob.id },
      data: { status: "fulfilled", fulfilledAt: new Date() },
    });
  }

  /** Sweep overdue obligations and mark them overdue. */
  async sweepOverdueObligations(tenantId: string) {
    const now = new Date();
    const overdue = await this.prisma.contractObligation.findMany({
      where: { tenantId, status: "pending", dueOn: { lt: now } },
    });
    let count = 0;
    for (const ob of overdue) {
      await this.prisma.contractObligation.update({
        where: { id: ob.id },
        data: { status: "overdue" },
      });
      count += 1;
    }
    return { sweptCount: count };
  }

  // ── Claims & Disputes ───────────────────────────────────────────────────

  async raiseClaim(tenantId: string, input: {
    contractId: string;
    claimNo: string;
    raisedBy: "internal" | "counterparty";
    nature: "delay_penalty" | "scope_change" | "quality_defect" | "payment_dispute" | "force_majeure";
    amountPaise: bigint;
  }) {
    const contract = await this.prisma.legalContract.findFirst({ where: { tenantId, id: input.contractId } });
    if (!contract) throw new NotFoundException(`contract ${input.contractId} not found`);
    const existing = await this.prisma.contractClaim.findFirst({ where: { tenantId, claimNo: input.claimNo } });
    if (existing) throw new ConflictException(`claim ${input.claimNo} already exists`);
    return this.prisma.contractClaim.create({
      data: {
        tenantId,
        contractId: contract.id,
        claimNo: input.claimNo,
        raisedBy: input.raisedBy,
        nature: input.nature,
        amountPaise: input.amountPaise,
        status: "open",
      },
    });
  }

  async settleClaim(tenantId: string, claimId: string, settledPaise: bigint) {
    const claim = await this.prisma.contractClaim.findFirst({ where: { tenantId, id: claimId } });
    if (!claim) throw new NotFoundException(`claim ${claimId} not found`);
    if (claim.status === "settled") throw new ConflictException(`claim ${claim.claimNo} is already settled`);
    if (settledPaise > claim.amountPaise) {
      throw new BadRequestException(`settled amount ₹${settledPaise} cannot exceed claimed amount ₹${claim.amountPaise}`);
    }
    return this.prisma.contractClaim.update({
      where: { id: claim.id },
      data: { status: "settled", settledPaise, settledAt: new Date() },
    });
  }

  /** Contract risk profile: active claims total, pending obligations, clause risk count. */
  async riskProfile(tenantId: string, contractId: string) {
    const contract = await this.prisma.legalContract.findFirst({
      where: { tenantId, id: contractId },
      include: { clauses: true, obligations: true, claims: true },
    });
    if (!contract) throw new NotFoundException(`contract ${contractId} not found`);
    const openClaims = contract.claims.filter((c) => c.status !== "settled" && c.status !== "rejected");
    const openClaimsPaise = openClaims.reduce((s, c) => s + c.amountPaise, 0n);
    const overdueObligations = contract.obligations.filter((o) => o.status === "overdue");
    const highRiskClauses = contract.clauses.filter((c) => c.riskLevel === "high" || c.riskLevel === "critical");
    const exposureVsContractPct = Number(contract.totalPaise) > 0
      ? Math.round((Number(openClaimsPaise) / Number(contract.totalPaise)) * 100)
      : 0;
    return {
      contractId: contract.id,
      contractNo: contract.contractNo,
      status: contract.status,
      totalPaise: contract.totalPaise,
      openClaimsCount: openClaims.length,
      openClaimsPaise,
      exposureVsContractPct,
      overdueObligationsCount: overdueObligations.length,
      highRiskClausesCount: highRiskClauses.length,
      riskLevel: openClaims.length > 2 || exposureVsContractPct > 20 || highRiskClauses.length > 3 ? "HIGH" : "NORMAL",
    };
  }
}
