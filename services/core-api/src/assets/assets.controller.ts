import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { AssetsService } from "./assets.service.js";

const createAssetDto = z.object({
  assetTag: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  projectId: z.string().uuid().optional(),
  location: z.string().optional(),
  purchaseDate: z.string().datetime(),
  purchaseValPaise: z.string().regex(/^\d+$/),
  salvageValPaise: z.string().regex(/^\d+$/).optional(),
  usefulLifeMonths: z.number().int().positive(),
  meterUnit: z.string().optional(),
});

const meterDto = z.object({
  meterVal: z.number().min(0),
});

const planDto = z.object({
  title: z.string().min(1),
  intervalDays: z.number().int().positive().optional(),
  meterInterval: z.number().positive().optional(),
});

const workOrderDto = z.object({
  woNo: z.string().min(1),
  assetId: z.string().uuid(),
  planId: z.string().uuid().optional(),
  type: z.enum(["preventive", "corrective", "breakdown", "inspection"]),
  description: z.string().min(1),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  assignedTo: z.string().optional(),
  breakdownAt: z.string().datetime().optional(),
});

const completeWoDto = z.object({
  completedAt: z.string().datetime(),
  spares: z.array(z.object({
    materialId: z.string().min(1),
    qty: z.number().positive(),
    unitCostPaise: z.string().regex(/^\d+$/),
  })).optional(),
});

@ApiTags("assets")
@Controller("assets")
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post()
  async createAsset(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = createAssetDto.parse(body);
    const ctx = getRequestContext();
    return this.assets.createAsset(ctx!.tenantId!, {
      assetTag: dto.assetTag,
      name: dto.name,
      category: dto.category,
      projectId: dto.projectId,
      location: dto.location,
      purchaseDate: new Date(dto.purchaseDate),
      purchaseValPaise: BigInt(dto.purchaseValPaise),
      salvageValPaise: dto.salvageValPaise ? BigInt(dto.salvageValPaise) : undefined,
      usefulLifeMonths: dto.usefulLifeMonths,
      meterUnit: dto.meterUnit,
    });
  }

  @Get(":id/depreciation")
  async depreciationSchedule(@Param("id") id: string, @Query("asOfDate") asOfDate?: string): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.assets.depreciationSchedule(ctx!.tenantId!, id, asOfDate ? new Date(asOfDate) : new Date());
  }

  @Post(":id/meter")
  async recordMeter(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = meterDto.parse(body);
    const ctx = getRequestContext();
    return this.assets.recordMeterReading(ctx!.tenantId!, id, dto.meterVal);
  }

  @Post(":id/plans")
  async createPlan(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = planDto.parse(body);
    const ctx = getRequestContext();
    return this.assets.createPlan(ctx!.tenantId!, id, dto);
  }

  @Post("work-orders")
  async createWorkOrder(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = workOrderDto.parse(body);
    const ctx = getRequestContext();
    return this.assets.createWorkOrder(ctx!.tenantId!, {
      woNo: dto.woNo,
      assetId: dto.assetId,
      planId: dto.planId,
      type: dto.type,
      description: dto.description,
      priority: dto.priority,
      assignedTo: dto.assignedTo,
      breakdownAt: dto.breakdownAt ? new Date(dto.breakdownAt) : undefined,
    });
  }

  @Post("work-orders/:woNo/complete")
  async completeWorkOrder(@Param("woNo") woNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = completeWoDto.parse(body);
    const ctx = getRequestContext();
    return this.assets.completeWorkOrder(ctx!.tenantId!, woNo, {
      completedAt: new Date(dto.completedAt),
      spares: dto.spares?.map((s) => ({ ...s, unitCostPaise: BigInt(s.unitCostPaise) })),
    });
  }

  @Get(":id/reliability")
  async reliabilityMetrics(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.assets.reliabilityMetrics(ctx!.tenantId!, id);
  }
}
