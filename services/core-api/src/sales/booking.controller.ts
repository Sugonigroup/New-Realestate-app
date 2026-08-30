import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { BookingService } from "./booking.service.js";

const holdDto = z.object({
  unitId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  holdHours: z.number().int().min(1).max(72).optional(),
});

const submitDto = z.object({
  unitId: z.string().uuid(),
  holdId: z.string().uuid(),
  leadId: z.string().uuid().optional(),
  customerName: z.string().min(1),
  customerPhone: z.string().regex(/^\+91\d{10}$/),
  planCode: z.string().min(1),
  planType: z.enum(["CLP", "DPLP", "PLP"]),
  milestones: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      percent: z.number(),
      trigger: z.object({
        kind: z.enum(["on_booking", "days_from_booking", "construction_milestone"]),
        days: z.number().optional(),
        milestoneKey: z.string().optional(),
      }),
    }),
  ),
  totalPaise: z.string().regex(/^\d+$/),
  discountPct: z.number().min(0).max(12),
});

const cancelDto = z.object({
  initiator: z.enum(["customer", "builder"]),
  stage: z.enum(["pre_aft", "post_aft", "post_possession"]),
  paidPaise: z.string().regex(/^\d+$/),
  builderDelayDays: z.number().int().optional(),
});

@ApiTags("sales")
@Controller("bookings")
export class BookingController {
  constructor(
    private readonly bookings: BookingService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post()
  async hold(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("sales.booking.create");
    const dto = holdDto.parse(body);
    const ctx = getRequestContext();
    return this.bookings.holdUnit({
      tenantId: ctx!.tenantId!,
      unitId: dto.unitId,
      userId: ctx!.userId!,
      leadId: dto.leadId,
      holdHours: dto.holdHours,
    });
  }

  @Post("submit")
  async submit(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("sales.booking.create");
    const dto = submitDto.parse(body);
    const ctx = getRequestContext();
    return this.bookings.submitBooking({
      tenantId: ctx!.tenantId!,
      unitId: dto.unitId,
      holdId: dto.holdId,
      leadId: dto.leadId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      planCode: dto.planCode,
      planType: dto.planType,
      milestones: dto.milestones as unknown as Parameters<BookingService["submitBooking"]>[0]["milestones"],
      totalPaise: BigInt(dto.totalPaise),
      discountPct: dto.discountPct,
      initiatorUserId: ctx!.userId!,
    });
  }

  @Post(":id/confirm")
  async confirm(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("sales.booking.create");
    const ctx = getRequestContext();
    return this.bookings.confirmBooking(ctx!.tenantId!, id, ctx!.userId!);
  }

  @Post(":id/cancel")
  async cancel(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("sales.booking.create");
    const dto = cancelDto.parse(body);
    const ctx = getRequestContext();
    return this.bookings.cancelBooking(ctx!.tenantId!, id, ctx!.userId!, {
      initiator: dto.initiator,
      stage: dto.stage,
      paidPaise: BigInt(dto.paidPaise),
      builderDelayDays: dto.builderDelayDays,
    });
  }

  @Post(":id/aft/:to")
  async advanceAft(@Param("id") id: string, @Param("to") to: "draft" | "sent" | "signed" | "registered"): Promise<unknown> {
    await this.permissions.requireAsync("crm.lead.update");
    const ctx = getRequestContext();
    return this.bookings.advanceAft(ctx!.tenantId!, id, to);
  }

  @Get()
  async list(@Query("status") status?: string): Promise<unknown> {
    await this.permissions.requireAsync("sales.read");
    const ctx = getRequestContext();
    return this.bookings.listBookings(ctx!.tenantId!, status);
  }

  @Get("units")
  async units(@Query("projectId") projectId: string): Promise<unknown> {
    await this.permissions.requireAsync("sales.inventory.read");
    const ctx = getRequestContext();
    return this.bookings.listUnits(ctx!.tenantId!, projectId);
  }
}
