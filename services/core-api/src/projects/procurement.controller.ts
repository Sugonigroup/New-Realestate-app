import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { ProcurementService } from "./procurement.service.js";

const raBillDto = z.object({
  projectId: z.string().uuid(),
  contractorId: z.string().min(1),
  billNo: z.string().min(1),
  billQty: z.number().positive(),
  billRatePaise: z.string().regex(/^\d+$/),
  mbQty: z.number().positive(),
  boqQty: z.number().positive(),
  boqRatePaise: z.string().regex(/^\d+$/),
  cumulativeBilledQty: z.number().positive(),
  soeQty: z.number().positive(),
});

@ApiTags("procurement")
@Controller("procurement")
export class ProcurementController {
  constructor(
    private readonly procurement: ProcurementService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("ra-bills")
  async submitRaBill(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("procurement.po.create");
    const dto = raBillDto.parse(body);
    const ctx = getRequestContext();
    return this.procurement.submitRaBill(ctx!.tenantId!, {
      projectId: dto.projectId,
      contractorId: dto.contractorId,
      billNo: dto.billNo,
      billQty: dto.billQty,
      billRatePaise: BigInt(dto.billRatePaise),
      mbQty: dto.mbQty,
      boqQty: dto.boqQty,
      boqRatePaise: BigInt(dto.boqRatePaise),
      cumulativeBilledQty: dto.cumulativeBilledQty,
      soeQty: dto.soeQty,
    });
  }

  @Get("ra-bills")
  async list(@Query("projectId") projectId?: string): Promise<unknown> {
    await this.permissions.requireAsync("procurement.read");
    const ctx = getRequestContext();
    return this.procurement.listRaBills(ctx!.tenantId!, projectId);
  }
}
