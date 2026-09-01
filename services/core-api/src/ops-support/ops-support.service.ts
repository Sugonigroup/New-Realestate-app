import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Operations Support service (P3):
 * - Risk Management: 5x5 probability x impact scoring, mitigation tracking
 * - Customer Service: Ticket lifecycle, SLA breach tracking, CSAT calculation
 * - Internal Audit: Finding registration, CAPA corrective actions, verification
 */

@Injectable()
export class OpsSupportService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Risk Management ─────────────────────────────────────────────────────

  async listRisks(tenantId: string) {
    return this.prisma.riskRegister.findMany({
      where: { tenantId },
      orderBy: { riskScore: "desc" },
      take: 200,
    });
  }

  async registerRisk(tenantId: string, input: {
    riskNo: string;
    title: string;
    category: "financial" | "safety" | "compliance" | "schedule" | "quality" | "reputational";
    probability: number; // 1-5
    impact: number; // 1-5
    mitigationPlan?: string;
    ownerRole: string;
    projectId?: string;
  }) {
    if (input.probability < 1 || input.probability > 5) throw new BadRequestException("probability must be 1-5");
    if (input.impact < 1 || input.impact > 5) throw new BadRequestException("impact must be 1-5");
    const existing = await this.prisma.riskRegister.findFirst({ where: { tenantId, riskNo: input.riskNo } });
    if (existing) throw new ConflictException(`risk ${input.riskNo} already exists`);

    const riskScore = input.probability * input.impact;
    return this.prisma.riskRegister.create({
      data: {
        tenantId,
        riskNo: input.riskNo,
        title: input.title,
        category: input.category,
        probability: input.probability,
        impact: input.impact,
        riskScore,
        mitigationPlan: input.mitigationPlan,
        ownerRole: input.ownerRole,
        projectId: input.projectId,
        status: "open",
      },
    });
  }

  async highRiskHeatmap(tenantId: string, projectId?: string) {
    const risks = await this.prisma.riskRegister.findMany({
      where: { tenantId, projectId: projectId ?? undefined, status: "open" },
    });
    const criticalCount = risks.filter((r) => r.riskScore >= 15).length;
    const highCount = risks.filter((r) => r.riskScore >= 10 && r.riskScore < 15).length;
    const mediumCount = risks.filter((r) => r.riskScore >= 5 && r.riskScore < 10).length;
    const lowCount = risks.filter((r) => r.riskScore < 5).length;

    return {
      totalOpenRisks: risks.length,
      criticalCount, // 15-25 (RED)
      highCount,     // 10-14 (AMBER)
      mediumCount,   // 5-9 (YELLOW)
      lowCount,      // 1-4 (GREEN)
      topRisks: risks.sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    };
  }

  // ── Customer Service ────────────────────────────────────────────────────

  async listTickets(tenantId: string) {
    return this.prisma.customerTicket.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async raiseTicket(tenantId: string, input: {
    ticketNo: string;
    customerName: string;
    customerPhone: string;
    category: string;
    description: string;
    priority?: "low" | "medium" | "high" | "critical";
    dueOn: Date;
    unitId?: string;
  }) {
    const existing = await this.prisma.customerTicket.findFirst({ where: { tenantId, ticketNo: input.ticketNo } });
    if (existing) throw new ConflictException(`ticket ${input.ticketNo} already exists`);

    return this.prisma.customerTicket.create({
      data: {
        tenantId,
        ticketNo: input.ticketNo,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        category: input.category,
        description: input.description,
        priority: input.priority ?? "medium",
        dueOn: input.dueOn,
        unitId: input.unitId,
        status: "open",
      },
    });
  }

  async resolveTicket(tenantId: string, ticketNo: string, csatRating?: number) {
    const ticket = await this.prisma.customerTicket.findFirst({ where: { tenantId, ticketNo } });
    if (!ticket) throw new NotFoundException(`ticket ${ticketNo} not found`);
    if (ticket.status === "resolved" || ticket.status === "closed") {
      throw new ConflictException(`ticket ${ticketNo} is already ${ticket.status}`);
    }
    if (csatRating && (csatRating < 1 || csatRating > 5)) {
      throw new BadRequestException("csatRating must be 1-5");
    }

    return this.prisma.customerTicket.update({
      where: { id: ticket.id },
      data: {
        status: "resolved",
        resolvedAt: new Date(),
        csatRating: csatRating ?? ticket.csatRating,
      },
    });
  }

  async csatAndSlaMetrics(tenantId: string) {
    const tickets = await this.prisma.customerTicket.findMany({ where: { tenantId } });
    if (tickets.length === 0) {
      return { totalTickets: 0, slaBreachPct: 0, avgCsat: null, resolvedCount: 0 };
    }

    let slaBreaches = 0;
    let csatSum = 0;
    let csatCount = 0;
    let resolvedCount = 0;

    for (const t of tickets) {
      if (t.status === "resolved" || t.status === "closed") {
        resolvedCount += 1;
        if (t.resolvedAt && t.resolvedAt > t.dueOn) slaBreaches += 1;
      } else if (new Date() > t.dueOn) {
        slaBreaches += 1;
      }

      if (t.csatRating) {
        csatSum += t.csatRating;
        csatCount += 1;
      }
    }

    const slaBreachPct = Math.round((slaBreaches / tickets.length) * 100);
    const avgCsat = csatCount > 0 ? Math.round((csatSum / csatCount) * 10) / 10 : null;

    return {
      totalTickets: tickets.length,
      resolvedCount,
      slaBreaches,
      slaBreachPct,
      avgCsat,
    };
  }

  // ── Internal Audit & CAPA ───────────────────────────────────────────────

  async listFindings(tenantId: string) {
    return this.prisma.auditFinding.findMany({
      where: { tenantId },
      orderBy: { dueOn: "asc" },
      take: 200,
    });
  }

  async raiseFinding(tenantId: string, input: {
    findingNo: string;
    auditedModule: string;
    title: string;
    description: string;
    severity?: "low" | "medium" | "high" | "critical";
    dueOn: Date;
    assignedTo?: string;
  }) {
    const existing = await this.prisma.auditFinding.findFirst({ where: { tenantId, findingNo: input.findingNo } });
    if (existing) throw new ConflictException(`finding ${input.findingNo} already exists`);

    return this.prisma.auditFinding.create({
      data: {
        tenantId,
        findingNo: input.findingNo,
        auditedModule: input.auditedModule,
        title: input.title,
        description: input.description,
        severity: input.severity ?? "medium",
        dueOn: input.dueOn,
        assignedTo: input.assignedTo,
        status: "open",
      },
    });
  }

  async submitCapa(tenantId: string, findingNo: string, capaPlan: string) {
    const finding = await this.prisma.auditFinding.findFirst({ where: { tenantId, findingNo } });
    if (!finding) throw new NotFoundException(`finding ${findingNo} not found`);

    return this.prisma.auditFinding.update({
      where: { id: finding.id },
      data: { status: "capa_submitted", capaPlan },
    });
  }

  async closeFinding(tenantId: string, findingNo: string) {
    const finding = await this.prisma.auditFinding.findFirst({ where: { tenantId, findingNo } });
    if (!finding) throw new NotFoundException(`finding ${findingNo} not found`);
    if (finding.status !== "capa_submitted" && finding.status !== "verified") {
      throw new BadRequestException(`cannot close finding ${findingNo} without CAPA plan submission`);
    }

    return this.prisma.auditFinding.update({
      where: { id: finding.id },
      data: { status: "closed", closedAt: new Date() },
    });
  }
}
