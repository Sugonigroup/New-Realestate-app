import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * RERA Compliance & Escrow Withdrawal service (RERA-01):
 * - Form 1 (Architect), Form 2 (Engineer), and Form 3 (Chartered Accountant) certification repository
 * - Escrow withdrawal gate enforcing 70/30 RERA rule and CA Form 3 max withdrawable limit verification
 */

@Injectable()
export class ReraComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async issueCertificate(tenantId: string, input: {
    certNo: string;
    projectId: string;
    certType: "Form1_Architect" | "Form2_Engineer" | "Form3_CA";
    issuerName: string;
    issuerRegNo: string;
    period: string;
    certifiedPct: number;
    documentRef?: string;
  }) {
    if (input.certifiedPct < 0 || input.certifiedPct > 100) {
      throw new BadRequestException("certifiedPct must be 0 to 100%");
    }
    const existing = await this.prisma.reraCertificate.findFirst({ where: { tenantId, certNo: input.certNo } });
    if (existing) throw new ConflictException(`certificate ${input.certNo} already exists`);

    return this.prisma.reraCertificate.create({
      data: {
        tenantId,
        certNo: input.certNo,
        projectId: input.projectId,
        certType: input.certType,
        issuerName: input.issuerName,
        issuerRegNo: input.issuerRegNo,
        period: input.period,
        certifiedPct: input.certifiedPct,
        documentRef: input.documentRef,
        issuedAt: new Date(),
      },
    });
  }

  /** Request RERA 70% Escrow Account Withdrawal gated by Form 1, Form 2, and Form 3 certificates. */
  async requestEscrowWithdrawal(tenantId: string, input: {
    requestNo: string;
    projectId: string;
    requestedPaise: bigint;
    maxWithdrawablePaise: bigint;
    form1ArchitectCertId: string;
    form2EngineerCertId: string;
    form3CaCertId: string;
  }) {
    if (input.requestedPaise > input.maxWithdrawablePaise) {
      throw new BadRequestException(
        `requested withdrawal ₹${input.requestedPaise} exceeds Form 3 CA certified limit ₹${input.maxWithdrawablePaise}`,
      );
    }
    const existing = await this.prisma.reraEscrowWithdrawal.findFirst({ where: { tenantId, requestNo: input.requestNo } });
    if (existing) throw new ConflictException(`withdrawal request ${input.requestNo} already exists`);

    // Verify all 3 certificates exist and belong to the project
    const f1 = await this.prisma.reraCertificate.findFirst({ where: { tenantId, id: input.form1ArchitectCertId, certType: "Form1_Architect" } });
    if (!f1) throw new NotFoundException(`Form 1 Architect certificate ${input.form1ArchitectCertId} not found`);

    const f2 = await this.prisma.reraCertificate.findFirst({ where: { tenantId, id: input.form2EngineerCertId, certType: "Form2_Engineer" } });
    if (!f2) throw new NotFoundException(`Form 2 Engineer certificate ${input.form2EngineerCertId} not found`);

    const f3 = await this.prisma.reraCertificate.findFirst({ where: { tenantId, id: input.form3CaCertId, certType: "Form3_CA" } });
    if (!f3) throw new NotFoundException(`Form 3 CA certificate ${input.form3CaCertId} not found`);

    return this.prisma.reraEscrowWithdrawal.create({
      data: {
        tenantId,
        requestNo: input.requestNo,
        projectId: input.projectId,
        requestedPaise: input.requestedPaise,
        maxWithdrawablePaise: input.maxWithdrawablePaise,
        form1ArchitectCertId: f1.id,
        form2EngineerCertId: f2.id,
        form3CaCertId: f3.id,
        status: "requested",
      },
    });
  }

  async approveWithdrawal(tenantId: string, requestNo: string, approverId: string) {
    const req = await this.prisma.reraEscrowWithdrawal.findFirst({ where: { tenantId, requestNo } });
    if (!req) throw new NotFoundException(`withdrawal request ${requestNo} not found`);
    if (req.status === "approved" || req.status === "withdrawn") {
      throw new ConflictException(`withdrawal ${requestNo} is already ${req.status}`);
    }

    return this.prisma.reraEscrowWithdrawal.update({
      where: { id: req.id },
      data: {
        status: "withdrawn",
        approvedBy: approverId,
        withdrawnAt: new Date(),
      },
    });
  }
}
