import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { JournalAutomationService } from "../finance/journal-automation.service.js";
import { MetricsService } from "../analytics/metrics.service.js";

const templateDto = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  lines: z.array(z.object({
    accountCode: z.string().min(1),
    debitPaise: z.union([z.string().regex(/^\d+$/), z.literal("amount")]).optional(),
    creditPaise: z.union([z.string().regex(/^\d+$/), z.literal("amount")]).optional(),
    description: z.string().optional(),
  })).min(2),
});

const ruleDto = z.object({
  templateCode: z.string().min(1),
  frequency: z.enum(["monthly", "quarterly"]),
  dayOfMonth: z.number().int().min(1).max(28),
  nextRunOn: z.string().datetime(),
});

const runDto = z.object({
  amountPaise: z.string().regex(/^\d+$/),
  asOfDate: z.string().datetime().optional(),
});

const metricDto = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  domain: z.enum(["sales", "finance", "projects", "safety", "hr"]),
  unit: z.enum(["paise", "pct", "count", "days"]),
  direction: z.enum(["up_is_good", "down_is_good"]).optional(),
});

const snapshotDto = z.object({
  code: z.string().min(1),
  period: z.string().min(1),
  valueNum: z.number(),
  dimensions: z.record(z.string()).optional(),
});

@ApiTags("platform")
@Controller("platform")
export class PlatformController {
  constructor(
    private readonly journals: JournalAutomationService,
    private readonly metrics: MetricsService,
    private readonly permissions: PermissionsService,
  ) {}

  // ── FIN-03 journal automation ───────────────────────────────────────────

  @Post("journal-templates")
  async createTemplate(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create");
    const dto = templateDto.parse(body);
    const ctx = getRequestContext();
    return this.journals.createTemplate(ctx!.tenantId!, {
      code: dto.code,
      name: dto.name,
      description: dto.description,
      lines: dto.lines.map((l) => ({
        accountCode: l.accountCode,
        debitPaise: l.debitPaise === "amount" ? ("amount" as const) : l.debitPaise ? BigInt(l.debitPaise) : undefined,
        creditPaise: l.creditPaise === "amount" ? ("amount" as const) : l.creditPaise ? BigInt(l.creditPaise) : undefined,
        description: l.description,
      })),
    });
  }

  @Post("journal-rules")
  async createRule(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create");
    const dto = ruleDto.parse(body);
    const ctx = getRequestContext();
    return this.journals.createRecurringRule(ctx!.tenantId!, {
      templateCode: dto.templateCode,
      frequency: dto.frequency,
      dayOfMonth: dto.dayOfMonth,
      nextRunOn: new Date(dto.nextRunOn),
    });
  }

  @Post("journal-rules/:templateCode/run")
  async runRule(@Param("templateCode") templateCode: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create");
    const dto = runDto.parse(body);
    const ctx = getRequestContext();
    return this.journals.runRecurring(ctx!.tenantId!, templateCode, BigInt(dto.amountPaise), dto.asOfDate ? new Date(dto.asOfDate) : new Date());
  }

  // ── BI-01 metrics ───────────────────────────────────────────────────────

  @Post("metrics")
  async registerMetric(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = metricDto.parse(body);
    const ctx = getRequestContext();
    return this.metrics.registerMetric(ctx!.tenantId!, dto);
  }

  @Post("metrics/snapshots")
  async recordSnapshot(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const dto = snapshotDto.parse(body);
    const ctx = getRequestContext();
    return this.metrics.recordSnapshot(ctx!.tenantId!, dto);
  }

  @Get("metrics/:code/latest")
  async latestMetric(@Param("code") code: string): Promise<unknown> {
    await this.permissions.requireAsync("reports.read");
    const ctx = getRequestContext();
    return this.metrics.latest(ctx!.tenantId!, code);
  }
}
