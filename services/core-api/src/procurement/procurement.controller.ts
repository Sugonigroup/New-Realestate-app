import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { ProcurementService } from "./procurement.service.js";

const vendorDto = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  gstin: z.string().optional(),
});

const prDto = z.object({
  reqNo: z.string().min(1),
  projectId: z.string().uuid(),
  requiredBy: z.string().datetime().optional(),
  lines: z.array(z.object({
    materialId: z.string().min(1),
    materialName: z.string().min(1),
    unit: z.string().min(1),
    qty: z.number().positive(),
    estRatePaise: z.string().regex(/^\d+$/),
    remark: z.string().optional(),
  })).min(1),
});

const rfqDto = z.object({
  rfqNo: z.string().min(1),
  requisitionId: z.string().uuid(),
  closesAt: z.string().datetime().optional(),
});

const quoteDto = z.object({
  vendorId: z.string().uuid(),
  deliveryDays: z.number().int().min(0),
  lines: z.array(z.object({
    materialId: z.string().min(1),
    qty: z.number().positive(),
    ratePaise: z.string().regex(/^\d+$/),
  })).min(1),
});

const awardDto = z.object({
  quoteId: z.string().uuid(),
  poNo: z.string().min(1),
  projectId: z.string().uuid(),
  promisedDate: z.string().datetime().optional(),
});

const grnDto = z.object({
  grnNo: z.string().min(1),
  orderId: z.string().uuid(),
  projectId: z.string().uuid(),
  receivedAt: z.string().datetime(),
  lines: z.array(z.object({
    poLineId: z.string().uuid(),
    qty: z.number().positive(),
    acceptedQty: z.number().min(0),
    rejectedQty: z.number().min(0).optional(),
    remark: z.string().optional(),
  })).min(1),
});

@ApiTags("procurement")
@Controller("procurement")
export class ProcurementController {
  constructor(
    private readonly procurement: ProcurementService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get("dashboard")
  async dashboard(): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.dashboard(ctx!.tenantId!);
  }

  @Get("vendors")
  async vendors(): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.listVendors(ctx!.tenantId!);
  }

  @Get("prs")
  async prs(): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.listPrs(ctx!.tenantId!);
  }

  @Get("rfqs")
  async rfqs(): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.listRfqs(ctx!.tenantId!);
  }

  @Get("rfqs/:id")
  async rfq(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.getRfq(ctx!.tenantId!, id);
  }

  @Get("orders")
  async orders(): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.listOrders(ctx!.tenantId!);
  }

  @Get("grns")
  async grns(): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.listGrns(ctx!.tenantId!);
  }

  @Post("vendors")
  async createVendor(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("procurement.vendor.create");
    const dto = vendorDto.parse(body);
    const ctx = getRequestContext();
    return this.procurement.createVendor(ctx!.tenantId!, dto);
  }

  @Get("vendors/:id/rating")
  async vendorRating(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.vendorRating(ctx!.tenantId!, id);
  }

  @Post("prs")
  async createPr(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("procurement.requisition.create");
    const dto = prDto.parse(body);
    const ctx = getRequestContext();
    return this.procurement.createPr(ctx!.tenantId!, {
      reqNo: dto.reqNo,
      projectId: dto.projectId,
      requestedBy: ctx!.userId!,
      requiredBy: dto.requiredBy ? new Date(dto.requiredBy) : undefined,
      lines: dto.lines.map((l) => ({ ...l, estRatePaise: BigInt(l.estRatePaise) })),
    });
  }

  @Post("prs/:id/approve")
  async approvePr(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("procurement.po.approve");
    const ctx = getRequestContext();
    return this.procurement.approvePr(ctx!.tenantId!, id, ctx!.userId!);
  }

  @Post("rfqs")
  async createRfq(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("procurement.rfq.create");
    const dto = rfqDto.parse(body);
    const ctx = getRequestContext();
    return this.procurement.createRfq(ctx!.tenantId!, {
      rfqNo: dto.rfqNo,
      requisitionId: dto.requisitionId,
      closesAt: dto.closesAt ? new Date(dto.closesAt) : undefined,
    });
  }

  @Post("rfqs/:id/quotes")
  async receiveQuote(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("procurement.rfq.create");
    const dto = quoteDto.parse(body);
    const ctx = getRequestContext();
    return this.procurement.receiveQuote(ctx!.tenantId!, {
      rfqId: id,
      vendorId: dto.vendorId,
      deliveryDays: dto.deliveryDays,
      lines: dto.lines.map((l) => ({ ...l, ratePaise: BigInt(l.ratePaise) })),
    });
  }

  @Get("rfqs/:id/comparison")
  async compareQuotes(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.compareQuotes(ctx!.tenantId!, id);
  }

  @Post("rfqs/:id/award")
  async award(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("procurement.po.approve");
    const dto = awardDto.parse(body);
    const ctx = getRequestContext();
    return this.procurement.awardQuote(ctx!.tenantId!, {
      rfqId: id,
      quoteId: dto.quoteId,
      poNo: dto.poNo,
      projectId: dto.projectId,
      promisedDate: dto.promisedDate ? new Date(dto.promisedDate) : undefined,
    });
  }

  @Post("grns")
  async receiveGrn(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("procurement.grn.create");
    const dto = grnDto.parse(body);
    const ctx = getRequestContext();
    return this.procurement.receiveGrn(ctx!.tenantId!, {
      grnNo: dto.grnNo,
      orderId: dto.orderId,
      projectId: dto.projectId,
      receivedAt: new Date(dto.receivedAt),
      lines: dto.lines,
    });
  }
}
