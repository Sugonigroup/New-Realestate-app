import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { OpsSupportService } from "./ops-support.service.js";

const riskDto = z.object({
  riskNo: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(["financial", "safety", "compliance", "schedule", "quality", "reputational"]),
  probability: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  mitigationPlan: z.string().optional(),
  ownerRole: z.string().min(1),
  projectId: z.string().uuid().optional(),
});

const ticketDto = z.object({
  ticketNo: z.string().min(1),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  dueOn: z.string().datetime(),
  unitId: z.string().uuid().optional(),
});

const resolveDto = z.object({
  csatRating: z.number().int().min(1).max(5).optional(),
});

const findingDto = z.object({
  findingNo: z.string().min(1),
  auditedModule: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  dueOn: z.string().datetime(),
  assignedTo: z.string().optional(),
});

const capaDto = z.object({
  capaPlan: z.string().min(1),
});

@ApiTags("ops-support")
@Controller("ops-support")
export class OpsSupportController {
  constructor(
    private readonly ops: OpsSupportService,
    private readonly permissions: PermissionsService,
  ) {}

  // ── Risk ────────────────────────────────────────────────────────────────

  @Post("risks")
  async registerRisk(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = riskDto.parse(body);
    const ctx = getRequestContext();
    return this.ops.registerRisk(ctx!.tenantId!, dto);
  }

  @Get("risks/heatmap")
  async highRiskHeatmap(@Query("projectId") projectId?: string): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.ops.highRiskHeatmap(ctx!.tenantId!, projectId);
  }

  // ── Customer Service ────────────────────────────────────────────────────

  @Post("tickets")
  async raiseTicket(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = ticketDto.parse(body);
    const ctx = getRequestContext();
    return this.ops.raiseTicket(ctx!.tenantId!, {
      ...dto,
      dueOn: new Date(dto.dueOn),
    });
  }

  @Post("tickets/:ticketNo/resolve")
  async resolveTicket(@Param("ticketNo") ticketNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = resolveDto.parse(body);
    const ctx = getRequestContext();
    return this.ops.resolveTicket(ctx!.tenantId!, ticketNo, dto.csatRating);
  }

  @Get("tickets/csat-sla")
  async csatAndSlaMetrics(): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.ops.csatAndSlaMetrics(ctx!.tenantId!);
  }

  // ── Audit & CAPA ────────────────────────────────────────────────────────

  @Post("findings")
  async raiseFinding(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("audit.read");
    const dto = findingDto.parse(body);
    const ctx = getRequestContext();
    return this.ops.raiseFinding(ctx!.tenantId!, {
      ...dto,
      dueOn: new Date(dto.dueOn),
    });
  }

  @Post("findings/:findingNo/capa")
  async submitCapa(@Param("findingNo") findingNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("audit.read");
    const dto = capaDto.parse(body);
    const ctx = getRequestContext();
    return this.ops.submitCapa(ctx!.tenantId!, findingNo, dto.capaPlan);
  }

  @Post("findings/:findingNo/close")
  async closeFinding(@Param("findingNo") findingNo: string): Promise<unknown> {
    await this.permissions.requireAsync("audit.read");
    const ctx = getRequestContext();
    return this.ops.closeFinding(ctx!.tenantId!, findingNo);
  }
}
