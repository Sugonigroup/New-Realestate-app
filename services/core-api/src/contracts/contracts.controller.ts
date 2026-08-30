import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { ContractsService } from "./contracts.service.js";

const createContractDto = z.object({
  contractNo: z.string().min(1),
  title: z.string().min(1),
  partyName: z.string().min(1),
  partyRole: z.enum(["contractor", "vendor", "landowner", "consultant", "client"]),
  projectId: z.string().uuid().optional(),
  totalPaise: z.string().regex(/^\d+$/),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  clauses: z.array(z.object({
    sectionNo: z.string().min(1),
    title: z.string().min(1),
    bodyText: z.string().min(1),
    isStandard: z.boolean().optional(),
    riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
  })).optional(),
  obligations: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    dueOn: z.string().datetime(),
    ownerRole: z.string().min(1),
  })).optional(),
});

const clauseDto = z.object({
  sectionNo: z.string().min(1),
  title: z.string().min(1),
  bodyText: z.string().min(1),
  isStandard: z.boolean().optional(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]).optional(),
});

const claimDto = z.object({
  claimNo: z.string().min(1),
  raisedBy: z.enum(["internal", "counterparty"]),
  nature: z.enum(["delay_penalty", "scope_change", "quality_defect", "payment_dispute", "force_majeure"]),
  amountPaise: z.string().regex(/^\d+$/),
});

const settleDto = z.object({
  settledPaise: z.string().regex(/^\d+$/),
});

@ApiTags("contracts")
@Controller("contracts")
export class ContractsController {
  constructor(
    private readonly contracts: ContractsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post()
  async createContract(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = createContractDto.parse(body);
    const ctx = getRequestContext();
    return this.contracts.createContract(ctx!.tenantId!, {
      contractNo: dto.contractNo,
      title: dto.title,
      partyName: dto.partyName,
      partyRole: dto.partyRole,
      projectId: dto.projectId,
      totalPaise: BigInt(dto.totalPaise),
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      clauses: dto.clauses,
      obligations: dto.obligations?.map((o) => ({ ...o, dueOn: new Date(o.dueOn) })),
    });
  }

  @Post(":id/activate")
  async activate(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const signedAtStr = (body as { signedAt?: string })?.signedAt;
    const ctx = getRequestContext();
    return this.contracts.activateContract(ctx!.tenantId!, id, signedAtStr ? new Date(signedAtStr) : new Date());
  }

  @Post(":id/clauses")
  async addClause(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = clauseDto.parse(body);
    const ctx = getRequestContext();
    return this.contracts.addClause(ctx!.tenantId!, id, dto);
  }

  @Post("obligations/:id/fulfill")
  async fulfillObligation(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.contracts.fulfillObligation(ctx!.tenantId!, id);
  }

  @Post("obligations/sweep")
  async sweepObligations(): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.contracts.sweepOverdueObligations(ctx!.tenantId!);
  }

  @Post(":id/claims")
  async raiseClaim(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = claimDto.parse(body);
    const ctx = getRequestContext();
    return this.contracts.raiseClaim(ctx!.tenantId!, {
      contractId: id,
      claimNo: dto.claimNo,
      raisedBy: dto.raisedBy,
      nature: dto.nature,
      amountPaise: BigInt(dto.amountPaise),
    });
  }

  @Post("claims/:id/settle")
  async settleClaim(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const dto = settleDto.parse(body);
    const ctx = getRequestContext();
    return this.contracts.settleClaim(ctx!.tenantId!, id, BigInt(dto.settledPaise));
  }

  @Get(":id/risk")
  async riskProfile(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("projects.read");
    const ctx = getRequestContext();
    return this.contracts.riskProfile(ctx!.tenantId!, id);
  }
}
