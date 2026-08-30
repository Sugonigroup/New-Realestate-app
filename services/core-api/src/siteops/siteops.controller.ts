import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { SubcontractorService } from "./subcontractor.service.js";
import { QualityService } from "./quality.service.js";
import { HseService } from "./hse.service.js";

const subWoDto = z.object({
  woNo: z.string().min(1),
  projectId: z.string().uuid(),
  contractorId: z.string().uuid(),
  title: z.string().min(1),
  totalPaise: z.string().regex(/^\d+$/),
  retentionPct: z.number().optional(),
});

const raBillDto = z.object({
  billNo: z.string().min(1),
  workOrderId: z.string().uuid(),
  period: z.string().min(1),
  grossValPaise: z.string().regex(/^\d+$/),
  advanceRecPaise: z.string().regex(/^\d+$/).optional(),
  tdsRateBps: z.number().int().optional(),
});

const pourCardDto = z.object({
  pourNo: z.string().min(1),
  projectId: z.string().uuid(),
  locationElement: z.string().min(1),
  concreteGrade: z.string().min(1),
  targetVolumeCum: z.number().positive(),
});

const clearanceDto = z.object({
  rebarCleared: z.boolean().optional(),
  shutterCleared: z.boolean().optional(),
  mepCleared: z.boolean().optional(),
  qcCleared: z.boolean().optional(),
});

const cubeTestDto = z.object({
  sampleNo: z.string().min(1),
  testingAgeDays: z.number().int(),
  targetNmm2: z.number().positive(),
  actualNmm2: z.number().positive(),
});

const ncrDto = z.object({
  ncrNo: z.string().min(1),
  projectId: z.string().uuid(),
  description: z.string().min(1),
  severity: z.enum(["minor", "medium", "major", "critical"]).optional(),
  vendorId: z.string().uuid().optional(),
});

const permitDto = z.object({
  permitNo: z.string().min(1),
  projectId: z.string().uuid(),
  workType: z.enum(["hot_work", "height_work", "excavation", "confined_space", "electrical"]),
  location: z.string().min(1),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime(),
  safetyOfficer: z.string().min(1),
});

const incidentDto = z.object({
  incidentNo: z.string().min(1),
  projectId: z.string().uuid(),
  severity: z.number().int().min(1).max(5),
  location: z.string().min(1),
  description: z.string().min(1),
});

@ApiTags("siteops")
@Controller("siteops")
export class SiteOpsController {
  constructor(
    private readonly sub: SubcontractorService,
    private readonly quality: QualityService,
    private readonly hse: HseService,
    private readonly permissions: PermissionsService,
  ) {}

  // ── Subcontractors ──────────────────────────────────────────────────────

  @Post("subcontractors/work-orders")
  async createSubWo(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = subWoDto.parse(body);
    const ctx = getRequestContext();
    return this.sub.createWorkOrder(ctx!.tenantId!, {
      ...dto,
      totalPaise: BigInt(dto.totalPaise),
    });
  }

  @Post("subcontractors/ra-bills")
  async submitRaBill(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = raBillDto.parse(body);
    const ctx = getRequestContext();
    return this.sub.submitRaBill(ctx!.tenantId!, {
      billNo: dto.billNo,
      workOrderId: dto.workOrderId,
      period: dto.period,
      grossValPaise: BigInt(dto.grossValPaise),
      advanceRecPaise: dto.advanceRecPaise ? BigInt(dto.advanceRecPaise) : undefined,
      tdsRateBps: dto.tdsRateBps,
    });
  }

  @Post("subcontractors/ra-bills/:billNo/certify")
  async certifyRaBill(@Param("billNo") billNo: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.sub.certifyRaBill(ctx!.tenantId!, billNo, ctx!.userId!);
  }

  // ── Quality ─────────────────────────────────────────────────────────────

  @Post("quality/pour-cards")
  async createPourCard(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = pourCardDto.parse(body);
    const ctx = getRequestContext();
    return this.quality.createPourCard(ctx!.tenantId!, dto);
  }

  @Post("quality/pour-cards/:pourNo/clearances")
  async updateClearances(@Param("pourNo") pourNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = clearanceDto.parse(body);
    const ctx = getRequestContext();
    return this.quality.updateClearances(ctx!.tenantId!, pourNo, { ...dto, approverId: ctx!.userId! });
  }

  @Post("quality/pour-cards/:pourNo/cube-tests")
  async recordCubeTest(@Param("pourNo") pourNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = cubeTestDto.parse(body);
    const ctx = getRequestContext();
    return this.quality.recordCubeTest(ctx!.tenantId!, pourNo, {
      sampleNo: dto.sampleNo,
      testingAgeDays: (dto.testingAgeDays === 7 ? 7 : 28) as 7 | 28,
      targetNmm2: dto.targetNmm2,
      actualNmm2: dto.actualNmm2,
    });
  }

  @Post("quality/ncrs")
  async raiseNcr(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = ncrDto.parse(body);
    const ctx = getRequestContext();
    return this.quality.raiseNcr(ctx!.tenantId!, dto);
  }

  // ── HSE ─────────────────────────────────────────────────────────────────

  @Post("hse/permits")
  async requestPermit(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = permitDto.parse(body);
    const ctx = getRequestContext();
    return this.hse.requestPermit(ctx!.tenantId!, {
      permitNo: dto.permitNo,
      projectId: dto.projectId,
      workType: dto.workType,
      location: dto.location,
      validFrom: new Date(dto.validFrom),
      validTo: new Date(dto.validTo),
      safetyOfficer: dto.safetyOfficer,
    });
  }

  @Post("hse/permits/:permitNo/approve")
  async approvePermit(@Param("permitNo") permitNo: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.hse.approvePermit(ctx!.tenantId!, permitNo, ctx!.userId!);
  }

  @Post("hse/incidents")
  async reportIncident(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = incidentDto.parse(body);
    const ctx = getRequestContext();
    return this.hse.reportIncident(ctx!.tenantId!, dto);
  }

  @Get("hse/projects/:id/safety-score")
  async siteSafetyScore(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.hse.siteSafetyScore(ctx!.tenantId!, id);
  }
}
