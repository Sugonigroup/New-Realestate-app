import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Quality Management & Concrete Pour Cards service (QMS-01):
 * - Concrete Pour Card 4-point clearance gate (rebar, shuttering, MEP conduits, QC signoff)
 * - Concrete Cube Test 7-day and 28-day target vs actual strength verification
 * - Non-Conformance Report (NCR) lifecycle with corrective root-cause tracking
 */

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Pour Cards ──────────────────────────────────────────────────────────

  async createPourCard(tenantId: string, input: {
    pourNo: string;
    projectId: string;
    locationElement: string;
    concreteGrade: string;
    targetVolumeCum: number;
  }) {
    const existing = await this.prisma.pourCard.findFirst({ where: { tenantId, pourNo: input.pourNo } });
    if (existing) throw new ConflictException(`pour card ${input.pourNo} already exists`);

    return this.prisma.pourCard.create({
      data: {
        tenantId,
        pourNo: input.pourNo,
        projectId: input.projectId,
        locationElement: input.locationElement,
        concreteGrade: input.concreteGrade,
        targetVolumeCum: input.targetVolumeCum,
        status: "pending",
      },
    });
  }

  /** Update clearance checklist & auto-approve pour card when all 4 checks pass. */
  async updateClearances(tenantId: string, pourNo: string, input: {
    rebarCleared?: boolean;
    shutterCleared?: boolean;
    mepCleared?: boolean;
    qcCleared?: boolean;
    approverId?: string;
  }) {
    const card = await this.prisma.pourCard.findFirst({ where: { tenantId, pourNo } });
    if (!card) throw new NotFoundException(`pour card ${pourNo} not found`);

    const rebar = input.rebarCleared ?? card.rebarCleared;
    const shutter = input.shutterCleared ?? card.shutterCleared;
    const mep = input.mepCleared ?? card.mepCleared;
    const qc = input.qcCleared ?? card.qcCleared;
    const allCleared = rebar && shutter && mep && qc;

    return this.prisma.pourCard.update({
      where: { id: card.id },
      data: {
        rebarCleared: rebar,
        shutterCleared: shutter,
        mepCleared: mep,
        qcCleared: qc,
        status: allCleared ? "approved" : "pending",
        approvedBy: allCleared ? input.approverId ?? "qc_lead" : card.approvedBy,
      },
    });
  }

  // ── Cube Strength Tests ─────────────────────────────────────────────────

  async recordCubeTest(tenantId: string, pourNo: string, input: {
    sampleNo: string;
    testingAgeDays: 7 | 28;
    targetNmm2: number;
    actualNmm2: number;
  }) {
    const card = await this.prisma.pourCard.findFirst({ where: { tenantId, pourNo } });
    if (!card) throw new NotFoundException(`pour card ${pourNo} not found`);

    // Passage condition: 7-day must reach >= 65% target, 28-day must reach >= 100% target
    const minRequired = input.testingAgeDays === 7 ? input.targetNmm2 * 0.65 : input.targetNmm2;
    const isPassed = input.actualNmm2 >= minRequired;

    return this.prisma.concreteCubeTest.create({
      data: {
        tenantId,
        pourCardId: card.id,
        sampleNo: input.sampleNo,
        testingAgeDays: input.testingAgeDays,
        targetNmm2: input.targetNmm2,
        actualNmm2: input.actualNmm2,
        isPassed,
        testedAt: new Date(),
      },
    });
  }

  // ── Non-Conformance Reports (NCR) ───────────────────────────────────────

  async raiseNcr(tenantId: string, input: {
    ncrNo: string;
    projectId: string;
    description: string;
    severity?: "minor" | "medium" | "major" | "critical";
    vendorId?: string;
  }) {
    const existing = await this.prisma.nonConformanceReport.findFirst({ where: { tenantId, ncrNo: input.ncrNo } });
    if (existing) throw new ConflictException(`NCR ${input.ncrNo} already exists`);

    return this.prisma.nonConformanceReport.create({
      data: {
        tenantId,
        ncrNo: input.ncrNo,
        projectId: input.projectId,
        description: input.description,
        severity: input.severity ?? "medium",
        vendorId: input.vendorId,
        status: "open",
      },
    });
  }

  async resolveNcr(tenantId: string, ncrNo: string, rootCause: string) {
    const ncr = await this.prisma.nonConformanceReport.findFirst({ where: { tenantId, ncrNo } });
    if (!ncr) throw new NotFoundException(`NCR ${ncrNo} not found`);

    return this.prisma.nonConformanceReport.update({
      where: { id: ncr.id },
      data: { status: "resolved", rootCause, resolvedAt: new Date() },
    });
  }
}
