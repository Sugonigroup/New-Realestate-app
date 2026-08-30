import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ComplianceService } from "./compliance.service.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { getRequestContext } from "../common/request-context.js";

@ApiTags("compliance")
@Controller("compliance")
export class ComplianceController {
  constructor(
    private readonly compliance: ComplianceService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get("qpr/draft")
  async qprDraft(
    @Query("projectId") projectId: string,
    @Query("stateCode") stateCode: string,
  ): Promise<unknown> {
    await this.permissions.requireAsync("compliance.read");
    const ctx = getRequestContext();
    return this.compliance.draftQprFromLive(ctx!.tenantId!, projectId, stateCode.toUpperCase());
  }

  @Get("qpr/bundle")
  async qprBundle(@Query("stateCode") stateCode: string): Promise<unknown> {
    await this.permissions.requireAsync("compliance.read");
    const ctx = getRequestContext();
    return this.compliance.exportBundle(ctx!.tenantId!, "", stateCode.toUpperCase());
  }

  @Get("statutory")
  async statutory(@Query("year") year: string, @Query("month") month: string): Promise<unknown> {
    await this.permissions.requireAsync("compliance.read");
    return this.compliance.statutoryMonth(Number(year), Number(month) - 1);
  }
}
