import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { MarketingService } from "./marketing.service.js";

const campaignDto = z.object({
  name: z.string().min(1),
  channel: z.enum(["meta", "google", "portal", "offline", "referral"]),
  projectId: z.string().uuid().optional(),
});

const spendDto = z.object({
  campaignId: z.string().uuid(),
  date: z.string().datetime(),
  spendPaise: z.string().regex(/^\d+$/),
  leads: z.number().int().min(0),
});

@ApiTags("marketing")
@Controller("marketing")
export class MarketingController {
  constructor(
    private readonly marketing: MarketingService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("campaigns")
  async create(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("marketing.read");
    const dto = campaignDto.parse(body);
    const ctx = getRequestContext();
    return this.marketing.createCampaign(ctx!.tenantId!, dto);
  }

  @Post("spend")
  async spend(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("marketing.read");
    const dto = spendDto.parse(body);
    const ctx = getRequestContext();
    return this.marketing.recordSpend(ctx!.tenantId!, dto.campaignId, new Date(dto.date), BigInt(dto.spendPaise), dto.leads);
  }

  @Get("roi")
  async roi(
    @Query("projectId") projectId?: string,
    @Query("model") model?: string,
  ): Promise<unknown> {
    await this.permissions.requireAsync("marketing.read");
    const ctx = getRequestContext();
    return this.marketing.campaignRoi(
      ctx!.tenantId!, projectId,
      (model as "first_touch" | "last_touch" | "linear") ?? "first_touch",
    );
  }
}
