import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { LandService } from "./land.service.js";

const parcelDto = z.object({
  parcelNo: z.string().min(1),
  surveyNo: z.string().min(1),
  location: z.string().min(1),
  areaSqFt: z.number().positive(),
  purchaseValPaise: z.string().regex(/^\d+$/),
  titleStatus: z.enum(["clear", "encumbered", "litigation"]).optional(),
  legalOpinionBy: z.string().optional(),
});

const jdaDto = z.object({
  jdaNo: z.string().min(1),
  landParcelId: z.string().uuid(),
  landownerName: z.string().min(1),
  landownerSharePct: z.number().min(0).max(100),
  developerSharePct: z.number().min(0).max(100),
  revenueSharePct: z.number().min(0).max(100).optional(),
  depositPaise: z.string().regex(/^\d+$/).optional(),
});

@ApiTags("land")
@Controller("land")
export class LandController {
  constructor(
    private readonly land: LandService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get("parcels")
  async listParcels(): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.land.listParcels(ctx!.tenantId!);
  }

  @Get("jdas")
  async listJdas(): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.land.listJdas(ctx!.tenantId!);
  }

  @Post("parcels")
  async registerParcel(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = parcelDto.parse(body);
    const ctx = getRequestContext();
    return this.land.registerLandParcel(ctx!.tenantId!, {
      ...dto,
      purchaseValPaise: BigInt(dto.purchaseValPaise),
    });
  }

  @Post("jdas")
  async executeJda(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = jdaDto.parse(body);
    const ctx = getRequestContext();
    return this.land.executeJda(ctx!.tenantId!, {
      ...dto,
      depositPaise: dto.depositPaise ? BigInt(dto.depositPaise) : undefined,
    });
  }

  @Get("jdas/:jdaNo/split")
  async calculateJdaSplit(@Param("jdaNo") jdaNo: string, @Query("totalRevenuePaise") totalRevenuePaise: string): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.land.calculateJdaSplit(ctx!.tenantId!, jdaNo, BigInt(totalRevenuePaise ?? "0"));
  }
}
