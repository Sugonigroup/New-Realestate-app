import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { BudgetingService } from "./budgeting.service.js";

const createBudgetDto = z.object({
  fiscalYear: z.string().min(1),
  title: z.string().min(1),
  lines: z.array(z.object({
    costCenter: z.string().min(1),
    accountCode: z.string().min(1),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    amountPaise: z.string().regex(/^\d+$/),
  })).min(1),
});

const scenarioDto = z.object({
  name: z.string().min(1),
  growthBps: z.number().int(),
  inflationBps: z.number().int(),
});

@ApiTags("budgeting")
@Controller("budgeting")
export class BudgetingController {
  constructor(
    private readonly budgeting: BudgetingService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("budgets")
  async createBudget(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = createBudgetDto.parse(body);
    const ctx = getRequestContext();
    return this.budgeting.createBudget(ctx!.tenantId!, {
      fiscalYear: dto.fiscalYear,
      title: dto.title,
      lines: dto.lines.map((l) => ({ ...l, amountPaise: BigInt(l.amountPaise) })),
    });
  }

  @Post("budgets/:id/approve")
  async approveBudget(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("workflow.approve");
    const ctx = getRequestContext();
    return this.budgeting.approveBudget(ctx!.tenantId!, id, ctx!.userId!);
  }

  @Post("budgets/:id/lock")
  async lockBudget(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("workflow.approve");
    const ctx = getRequestContext();
    return this.budgeting.lockBudget(ctx!.tenantId!, id);
  }

  @Post("budgets/:id/scenarios")
  async createScenario(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = scenarioDto.parse(body);
    const ctx = getRequestContext();
    return this.budgeting.createScenario(ctx!.tenantId!, {
      budgetId: id,
      name: dto.name,
      growthBps: dto.growthBps,
      inflationBps: dto.inflationBps,
    });
  }

  @Get("budgets/:id/variance")
  async varianceReport(@Param("id") id: string, @Query("period") period: string): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.budgeting.varianceReport(ctx!.tenantId!, id, period);
  }
}
