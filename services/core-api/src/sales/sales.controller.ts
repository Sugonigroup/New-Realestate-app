import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { computeUnitPrice, generateSchedule } from "./index.js";

const previewDto = z.object({
  priceList: z.object({
    baseRatePaise: z.string().regex(/^\d+$/),
    floorRisePaise: z.string().regex(/^\d+$/),
    viewPremiumPaise: z.string().regex(/^\d+$/),
    plcPaise: z.string().regex(/^\d+$/),
    edcPaise: z.string().regex(/^\d+$/),
    idcPaise: z.string().regex(/^\d+$/),
    clubPaise: z.string().regex(/^\d+$/),
    corpusPaise: z.string().regex(/^\d+$/),
    gstRateBps: z.number().int(),
  }),
  unit: z.object({
    sbaSqm: z.string(),
    floor: z.number().int().min(0),
    hasView: z.boolean().optional(),
  }),
  plan: z
    .object({
      planType: z.enum(["CLP", "DPLP", "PLP"]),
      milestones: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          percent: z.number(),
          trigger: z.object({ kind: z.enum(["on_booking", "days_from_booking", "construction_milestone"]), days: z.number().optional(), milestoneKey: z.string().optional() }),
        }),
      ),
      bookingDate: z.string().datetime(),
    })
    .optional(),
});

@ApiTags("sales")
@Controller("sales")
export class SalesController {
  constructor(private readonly permissions: PermissionsService) {}

  /** Price + schedule preview (pre-booking quote). Snapshot lands with the booking WP. */
  @Post("price-preview")
  async preview(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("sales.inventory.read");
    const dto = previewDto.parse(body);
    const price = computeUnitPrice(
      {
        ...dto.priceList,
        baseRatePaise: BigInt(dto.priceList.baseRatePaise),
        floorRisePaise: BigInt(dto.priceList.floorRisePaise),
        viewPremiumPaise: BigInt(dto.priceList.viewPremiumPaise),
        plcPaise: BigInt(dto.priceList.plcPaise),
        edcPaise: BigInt(dto.priceList.edcPaise),
        idcPaise: BigInt(dto.priceList.idcPaise),
        clubPaise: BigInt(dto.priceList.clubPaise),
        corpusPaise: BigInt(dto.priceList.corpusPaise),
      },
      dto.unit,
    );
    const schedule = dto.plan
      ? generateSchedule({
          planType: dto.plan.planType,
          milestones: dto.plan.milestones as never,
          total: price.total,
          bookingDate: new Date(dto.plan.bookingDate),
        })
      : null;
    return {
      lines: price.lines.map((l) => ({ ...l, amountPaise: l.amount.paise.toString(), formatted: l.amount.formatIndian() })),
      subtotalPaise: price.subtotal.paise.toString(),
      gstPaise: price.gst.paise.toString(),
      totalPaise: price.total.paise.toString(),
      totalFormatted: price.total.formatIndian(),
      schedule: schedule?.map((s) => ({
        seq: s.seq,
        key: s.key,
        label: s.label,
        amountPaise: s.amount.paise.toString(),
        formatted: s.amount.formatIndian(),
        dueDate: s.dueDate,
        trigger: s.trigger,
      })),
    };
  }
}
