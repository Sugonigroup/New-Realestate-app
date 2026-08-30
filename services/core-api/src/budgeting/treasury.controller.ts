import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { TreasuryService } from "./treasury.service.js";

const facilityDto = z.object({
  facilityNo: z.string().min(1),
  lenderName: z.string().min(1),
  facilityType: z.enum(["term_loan", "construction_finance", "cc_od", "lap"]),
  sanctionedPaise: z.string().regex(/^\d+$/),
  annualRateBps: z.number().int().positive(),
  tenureMonths: z.number().int().positive(),
  securedAgainst: z.string().optional(),
});

const txnDto = z.object({
  amountPaise: z.string().regex(/^\d+$/),
  txnDate: z.string().datetime().optional(),
});

const runwayDto = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  openingPaise: z.string().regex(/^\d+$/),
  inflowPaise: z.string().regex(/^\d+$/),
  outflowPaise: z.string().regex(/^\d+$/),
});

@ApiTags("treasury")
@Controller("treasury")
export class TreasuryController {
  constructor(
    private readonly treasury: TreasuryService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("facilities")
  async createFacility(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = facilityDto.parse(body);
    const ctx = getRequestContext();
    return this.treasury.createFacility(ctx!.tenantId!, {
      ...dto,
      sanctionedPaise: BigInt(dto.sanctionedPaise),
    });
  }

  @Post("facilities/:facilityNo/drawdown")
  async drawdown(@Param("facilityNo") facilityNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = txnDto.parse(body);
    const ctx = getRequestContext();
    return this.treasury.drawdown(ctx!.tenantId!, facilityNo, BigInt(dto.amountPaise), dto.txnDate ? new Date(dto.txnDate) : new Date());
  }

  @Post("facilities/:facilityNo/repay")
  async repay(@Param("facilityNo") facilityNo: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = txnDto.parse(body);
    const ctx = getRequestContext();
    return this.treasury.repay(ctx!.tenantId!, facilityNo, BigInt(dto.amountPaise), dto.txnDate ? new Date(dto.txnDate) : new Date());
  }

  @Get("facilities/:facilityNo/interest-forecast")
  async interestForecast(@Param("facilityNo") facilityNo: string): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.treasury.interestForecast(ctx!.tenantId!, facilityNo);
  }

  @Get("portfolio")
  async portfolioPosition(): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.treasury.portfolioPosition(ctx!.tenantId!);
  }

  @Post("cash-runway")
  async cashRunway(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = runwayDto.parse(body);
    const ctx = getRequestContext();
    return this.treasury.cashRunway(
      ctx!.tenantId!,
      dto.period,
      BigInt(dto.openingPaise),
      BigInt(dto.inflowPaise),
      BigInt(dto.outflowPaise),
    );
  }
}
