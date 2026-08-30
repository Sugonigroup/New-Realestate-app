import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { HrService } from "./hr.service.js";

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

@ApiTags("hr")
@Controller("hr")
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly permissions: PermissionsService,
  ) {}

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
}
