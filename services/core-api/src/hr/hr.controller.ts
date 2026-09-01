import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { HrService } from "./hr.service.js";
import { HrLifecycleService } from "./hr-lifecycle.service.js";

const checkInDto = z.object({
  employeeId: z.string().uuid(),
  deviceId: z.string().min(1),
  geoLat: z.number(),
  geoLng: z.number(),
  fenceCenter: z.object({ lat: z.number(), lng: z.number() }),
  fenceRadiusMeters: z.number().positive(),
});

const payrollDto = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  stateCode: z.enum(["KA", "MH", "TN", "TG", "UP"]),
  daysInMonth: z.number().int().min(28).max(31),
});

const reqDto = z.object({
  reqNo: z.string().min(1),
  position: z.string().min(1),
  department: z.string().min(1),
  headcount: z.number().int().positive().optional(),
  projectId: z.string().uuid().optional(),
});

const candidateDto = z.object({
  requisitionId: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  source: z.enum(["portal", "referral", "agency", "walk_in"]),
});

const stageDto = z.object({
  action: z.enum(["advance", "reject"]),
  rating: z.number().int().min(1).max(5).optional(),
});

const offerDto = z.object({
  offerNo: z.string().min(1),
  candidateId: z.string().uuid(),
  offeredCtcPaise: z.string().regex(/^\d+$/),
  validUntil: z.string().datetime(),
  joiningDate: z.string().datetime().optional(),
});

const respondDto = z.object({ accept: z.boolean() });

const exitDto = z.object({
  employeeId: z.string().uuid(),
  reason: z.enum(["resignation", "termination", "absconding", "retirement"]),
  noticeDays: z.number().int().positive().optional(),
  lastWorkingDay: z.string().datetime(),
});

const clearDto = z.object({
  duesSettledPaise: z.string().regex(/^\d+$/),
});

@ApiTags("hr")
@Controller("hr")
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly lifecycle: HrLifecycleService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get("employees")
  async employees(): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const ctx = getRequestContext();
    return this.hr.listEmployees(ctx!.tenantId!);
  }

  @Get("payroll")
  async payrollRuns(): Promise<unknown> {
    await this.permissions.requireAsync("payroll.read");
    const ctx = getRequestContext();
    return this.hr.listPayrollRuns(ctx!.tenantId!);
  }

  @Get("recruitment/candidates")
  async candidates(): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const ctx = getRequestContext();
    return this.lifecycle.listCandidates(ctx!.tenantId!);
  }

  @Get("recruitment/requisitions")
  async requisitions(): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const ctx = getRequestContext();
    return this.lifecycle.listRequisitions(ctx!.tenantId!);
  }

  @Post("attendance/check-in")
  async checkIn(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = checkInDto.parse(body);
    const ctx = getRequestContext();
    return this.hr.checkIn(ctx!.tenantId!, dto);
  }

  @Post("payroll/compute")
  async payroll(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("payroll.read");
    const dto = payrollDto.parse(body);
    const ctx = getRequestContext();
    return this.hr.computePayrollRun(ctx!.tenantId!, dto.period, dto.stateCode, dto.daysInMonth, ctx!.userId!);
  }

  @Get("muster")
  async muster(@Query("projectId") projectId: string): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const ctx = getRequestContext();
    return this.hr.muster(ctx!.tenantId!, projectId);
  }

  // ── HR Lifecycle (HR-01) ────────────────────────────────────────────────

  @Post("recruitment/requisitions")
  async createRequisition(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = reqDto.parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.createRequisition(ctx!.tenantId!, { ...dto, requesterId: ctx!.userId! });
  }

  @Post("recruitment/requisitions/:reqNo/approve")
  async approveRequisition(@Param("reqNo") reqNo: string): Promise<unknown> {
    await this.permissions.requireAsync("workflow.approve");
    const ctx = getRequestContext();
    return this.lifecycle.approveRequisition(ctx!.tenantId!, reqNo, ctx!.userId!);
  }

  @Post("recruitment/candidates")
  async addCandidate(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = candidateDto.parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.addCandidate(ctx!.tenantId!, dto);
  }

  @Post("recruitment/candidates/:id/stage")
  async moveStage(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = stageDto.parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.moveCandidateStage(ctx!.tenantId!, id, dto.action, dto.rating);
  }

  @Post("recruitment/offers")
  async issueOffer(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = offerDto.parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.issueOffer(ctx!.tenantId!, {
      offerNo: dto.offerNo,
      candidateId: dto.candidateId,
      offeredCtcPaise: BigInt(dto.offeredCtcPaise),
      validUntil: new Date(dto.validUntil),
      joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
    });
  }

  @Post("recruitment/offers/:offerNo/respond")
  async respondOffer(@Param("offerNo") offerNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = respondDto.parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.respondOffer(ctx!.tenantId!, offerNo, dto.accept);
  }

  @Post("recruitment/offers/:offerNo/join")
  async markJoined(@Param("offerNo") offerNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = z.object({ joiningDate: z.string().datetime() }).parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.markJoined(ctx!.tenantId!, offerNo, new Date(dto.joiningDate));
  }

  @Post("exits")
  async initiateExit(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("hr.read");
    const dto = exitDto.parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.initiateExit(ctx!.tenantId!, {
      employeeId: dto.employeeId,
      reason: dto.reason,
      noticeDays: dto.noticeDays,
      lastWorkingDay: new Date(dto.lastWorkingDay),
    });
  }

  @Post("exits/:employeeId/clear")
  async clearExit(@Param("employeeId") employeeId: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("workflow.approve");
    const dto = clearDto.parse(body);
    const ctx = getRequestContext();
    return this.lifecycle.clearExit(ctx!.tenantId!, employeeId, BigInt(dto.duesSettledPaise), ctx!.userId!);
  }
}
