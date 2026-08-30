import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { FinanceService } from "./finance.service.js";
import { EscrowService } from "./escrow.service.js";
import type { Instrument } from "./instruments.js";

const generateDto = z.object({
  bookingId: z.string().uuid(),
  certifiedMilestones: z.array(z.string()).optional(),
});

const receiptDto = z.object({
  bookingId: z.string().uuid(),
  unitId: z.string().uuid(),
  amountPaise: z.string().regex(/^\d+$/),
  instrument: z.enum(["gateway", "nach", "neft", "rtgs", "cheque", "cash"]),
  instrumentRef: z.string().optional(),
  gatewayRef: z.string().optional(),
});

const withdrawalDto = z.object({
  projectId: z.string().uuid(),
  amountPaise: z.string().regex(/^\d+$/),
  form3Ref: z.string().min(1),
  form4Ref: z.string().min(1),
  certifiedPct: z.number().min(0).max(100).optional(),
});

@ApiTags("finance")
@Controller("finance")
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly escrow: EscrowService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("demands/generate")
  async generate(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.demand.generate");
    const dto = generateDto.parse(body);
    const ctx = getRequestContext();
    return this.finance.generateFromBooking(ctx!.tenantId!, dto.bookingId, dto.certifiedMilestones);
  }

  @Get("demands")
  async demands(@Query("status") status?: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.demand.read");
    const ctx = getRequestContext();
    return this.finance.listDemands(ctx!.tenantId!, status);
  }

  @Post("receipts")
  async applyReceipt(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create");
    const dto = receiptDto.parse(body);
    const ctx = getRequestContext();
    return this.finance.applyReceipt({
      tenantId: ctx!.tenantId!,
      bookingId: dto.bookingId,
      unitId: dto.unitId,
      amountPaise: BigInt(dto.amountPaise),
      instrument: dto.instrument as Instrument,
      instrumentRef: dto.instrumentRef,
      gatewayRef: dto.gatewayRef,
    });
  }

  @Post("receipts/:id/bounce")
  async bounce(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.bounce");
    const ctx = getRequestContext();
    return this.finance.bounceReceipt(ctx!.tenantId!, id, ctx!.userId!);
  }

  @Get("ledger")
  async ledger(@Query("unitId") unitId: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.read");
    const ctx = getRequestContext();
    return this.finance.listLedger(ctx!.tenantId!, unitId);
  }

  @Get("receipts")
  async receipts(@Query("bookingId") bookingId?: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.read");
    const ctx = getRequestContext();
    return this.finance.listReceipts(ctx!.tenantId!, bookingId);
  }

  // ── Escrow (70% rule) ──

  @Get("escrow/summary")
  async escrowSummary(@Query("projectId") projectId: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.read");
    const ctx = getRequestContext();
    return this.escrow.summary(ctx!.tenantId!, projectId);
  }

  @Post("escrow/withdrawals")
  async requestWithdrawal(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.escrow.withdraw");
    const dto = withdrawalDto.parse(body);
    const ctx = getRequestContext();
    return this.escrow.requestWithdrawal(ctx!.tenantId!, dto.projectId, {
      amountPaise: BigInt(dto.amountPaise),
      requestedBy: ctx!.userId!,
      form3Ref: dto.form3Ref,
      form4Ref: dto.form4Ref,
      certifiedPct: dto.certifiedPct,
    });
  }

  @Post("escrow/withdrawals/:id/approve")
  async approveWithdrawal(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.escrow.approve");
    const ctx = getRequestContext();
    return this.escrow.approveWithdrawal(ctx!.tenantId!, id, ctx!.userId!);
  }
}
