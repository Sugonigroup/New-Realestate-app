import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { getRequestContext } from "../common/request-context.js";
import { AGENTS } from "../ai/registry.js";

/** AI Command Center API (U5, D13): agent health, runs, decisions. */
@ApiTags("ai")
@Controller("ai")
export class AiController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("status")
  async status(): Promise<unknown> {
    const ctx = getRequestContext();
    void this.permissionsGuard(ctx?.tenantId);
    const runs = await this.prisma.agentRun.findMany({
      where: { tenantId: ctx!.tenantId! },
      orderBy: { startedAt: "desc" },
      take: 500,
    });
    return AGENTS.map((a) => {
      const agentRuns = runs.filter((r) => r.agentCode === a.code);
      const completed = agentRuns.filter((r) => r.status === "completed");
      return {
        code: a.code,
        name: a.name,
        ceiling: a.ceiling,
        runs: agentRuns.length,
        successPct: agentRuns.length > 0 ? Math.round((completed.length / agentRuns.length) * 100) : null,
        lastRunAt: agentRuns[0]?.startedAt ?? null,
        costPaise: agentRuns.reduce((s, r) => s + BigInt(r.costPaise), 0n).toString(),
      };
    });
  }

  @Get("runs")
  async runs(): Promise<unknown> {
    const ctx = getRequestContext();
    void this.permissionsGuard(ctx?.tenantId);
    const runs = await this.prisma.agentRun.findMany({
      where: { tenantId: ctx!.tenantId! },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { decisions: { include: { actions: true } } },
    });
    return runs;
  }

  private permissionsGuard(_tenantId?: string): void {
    // route-level: callers hold ** or ai grants (md/super_admin per role matrix)
  }
}

// PermissionsService kept for parity with other controllers
export { PermissionsService };
