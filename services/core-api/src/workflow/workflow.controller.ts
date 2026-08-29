import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { PermissionsService } from "../permissions/permissions.service.js";
import { getRequestContext } from "../common/request-context.js";
import { WorkflowService } from "./workflow.service.js";
import type { TaskDecision } from "./state-machine.js";

const startDto = z.object({
  action: z.string().min(3),
  valuePaise: z.union([z.string().regex(/^\d+$/), z.number().int()]),
  payload: z.record(z.unknown()),
});

const actDto = z.object({
  decision: z.enum(["approve", "reject", "query", "escalate"]),
  comment: z.string().max(2000).optional(),
});

@ApiTags("workflow")
@Controller("workflows")
export class WorkflowController {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("start")
  async start(@Body() body: unknown): Promise<unknown> {
    this.permissions.require("workflow.start");
    const dto = startDto.parse(body);
    const ctx = getRequestContext();
    return this.workflow.start({
      tenantId: ctx!.tenantId!,
      action: dto.action,
      valuePaise: BigInt(dto.valuePaise),
      payload: dto.payload,
      initiatorUserId: ctx!.userId!,
      correlationId: ctx?.correlationId,
    });
  }

  @Get("my-tasks")
  async myTasks(): Promise<unknown> {
    this.permissions.require("workflow.approve");
    const ctx = getRequestContext();
    return this.workflow.myTasks(ctx!.tenantId!, { userId: ctx!.userId!, roles: ctx!.roleCodes ?? [] });
  }

  @Post("tasks/:id/act")
  async act(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    const dto = actDto.parse(body);
    const ctx = getRequestContext();
    return this.workflow.act({
      tenantId: ctx!.tenantId!,
      taskId: id,
      actorUserId: ctx!.userId!,
      actorRoles: ctx!.roleCodes ?? [],
      decision: dto.decision as TaskDecision,
      comment: dto.comment,
    });
  }
}
