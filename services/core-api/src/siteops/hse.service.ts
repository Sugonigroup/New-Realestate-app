import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Health, Safety & Environment (HSE) service (HSE-01):
 * - Permit to Work (PTW) approval workflow for high-risk construction activities
 * - Safety Incident reporting with Severity 1 (near-miss) to 5 (critical/fatality) matrix
 * - Site Safety Compliance metrics calculation
 */

@Injectable()
export class HseService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Permit to Work (PTW) ────────────────────────────────────────────────

  async requestPermit(tenantId: string, input: {
    permitNo: string;
    projectId: string;
    workType: "hot_work" | "height_work" | "excavation" | "confined_space" | "electrical";
    location: string;
    validFrom: Date;
    validTo: Date;
    safetyOfficer: string;
  }) {
    if (input.validTo <= input.validFrom) {
      throw new BadRequestException("validTo must be strictly after validFrom");
    }
    const existing = await this.prisma.permitToWork.findFirst({ where: { tenantId, permitNo: input.permitNo } });
    if (existing) throw new ConflictException(`permit ${input.permitNo} already exists`);

    return this.prisma.permitToWork.create({
      data: {
        tenantId,
        permitNo: input.permitNo,
        projectId: input.projectId,
        workType: input.workType,
        location: input.location,
        validFrom: input.validFrom,
        validTo: input.validTo,
        safetyOfficer: input.safetyOfficer,
        status: "requested",
      },
    });
  }

  async approvePermit(tenantId: string, permitNo: string, approverId: string) {
    const permit = await this.prisma.permitToWork.findFirst({ where: { tenantId, permitNo } });
    if (!permit) throw new NotFoundException(`permit ${permitNo} not found`);
    if (permit.status === "approved" || permit.status === "active") {
      throw new ConflictException(`permit ${permitNo} is already ${permit.status}`);
    }

    return this.prisma.permitToWork.update({
      where: { id: permit.id },
      data: { status: "active", approvedBy: approverId },
    });
  }

  // ── Safety Incidents ────────────────────────────────────────────────────

  async reportIncident(tenantId: string, input: {
    incidentNo: string;
    projectId: string;
    severity: number; // 1 (near miss) to 5 (fatality/critical)
    location: string;
    description: string;
    reportedAt?: Date;
  }) {
    if (input.severity < 1 || input.severity > 5) {
      throw new BadRequestException("severity must be 1 to 5");
    }
    const existing = await this.prisma.safetyIncident.findFirst({ where: { tenantId, incidentNo: input.incidentNo } });
    if (existing) throw new ConflictException(`incident ${input.incidentNo} already exists`);

    return this.prisma.safetyIncident.create({
      data: {
        tenantId,
        incidentNo: input.incidentNo,
        projectId: input.projectId,
        severity: input.severity,
        location: input.location,
        description: input.description,
        reportedAt: input.reportedAt ?? new Date(),
        status: "open",
      },
    });
  }

  async siteSafetyScore(tenantId: string, projectId: string) {
    const incidents = await this.prisma.safetyIncident.findMany({ where: { tenantId, projectId } });
    const permits = await this.prisma.permitToWork.findMany({ where: { tenantId, projectId } });

    const totalIncidents = incidents.length;
    const severeIncidents = incidents.filter((i: { severity: number }) => i.severity >= 3).length; // Severity 3-5
    const activePermits = permits.filter((p: { status: string }) => p.status === "active").length;

    // Safety Score starts at 100, deduct 5 for minor incidents, 20 for severe
    const penalty = incidents.reduce((sum: number, i: { severity: number }) => sum + (i.severity >= 3 ? 20 : 5), 0);
    const score = Math.max(0, 100 - penalty);
    const rating = score >= 90 ? "EXCELLENT" : score >= 75 ? "GOOD" : score >= 60 ? "NEEDS_IMPROVEMENT" : "CRITICAL_RISK";

    return {
      projectId,
      totalIncidents,
      severeIncidents,
      activePermitsCount: activePermits,
      safetyScore: score,
      rating,
    };
  }

  async listPermits(tenantId: string, projectId: string) {
    return this.prisma.permitToWork.findMany({
      where: { tenantId, projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  async listIncidents(tenantId: string, projectId: string) {
    return this.prisma.safetyIncident.findMany({
      where: { tenantId, projectId },
      orderBy: { reportedAt: "desc" },
    });
  }
}
