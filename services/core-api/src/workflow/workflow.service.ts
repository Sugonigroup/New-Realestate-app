import { ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  SEED_MATRIX,
  matrixFor,
  resolveApproval,
  type MatrixEntry,
} from "./authority-matrix.js";
import {
  applyInstanceStateTransition,
  applyTaskDecision,
  mayAct,
  slaDue,
  type TaskDecision,
} from "./state-machine.js";

export interface StartInput {
  tenantId: string;
  action: string;
  valuePaise: bigint;
  payload: unknown;
  initiatorUserId: string;
  correlationId?: string;
}

export interface ActInput {
  tenantId: string;
  taskId: string;
  actorUserId: string;
  actorRoles: string[];
  decision: TaskDecision;
  comment?: string;
}

/**
 * Approval engine (WP-0E): matrix-resolved routing, sequential maker-checker,
 * SLA + escalation, delegation, decision audit. The approval **is** the record —
 * callers execute the approved payload on `status: approved` (09 §1).
 * NOTE: multi-statement operations are wrapped in a transaction in the next
 * slice; v1 keeps sequential writes for testability.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly matrix: MatrixEntry[] = SEED_MATRIX,
  ) {}

  async start(input: StartInput): Promise<{ instanceId: string; taskId: string; approverRole: string }> {
    const entry = matrixFor(this.matrix, input.action);
    const value = Money.fromPaise(input.valuePaise);
    const resolution = resolveApproval(entry, value);
    const now = new Date();

    const instance = await this.prisma.workflowInstance.create({
      data: {
        tenantId: input.tenantId,
        action: input.action,
        state: "pending",
        valuePaise: input.valuePaise,
        payload: input.payload as object,
        initiatorUserId: input.initiatorUserId,
        correlationId: input.correlationId,
      },
    });
    const task = await this.prisma.approvalTask.create({
      data: {
        tenantId: input.tenantId,
        instanceId: instance.id,
        sequence: 1,
        state: "pending",
        assignedRole: resolution.approverRole,
        slaDue: slaDue(now, resolution.slaMinutes),
      },
    });
    return { instanceId: instance.id, taskId: task.id, approverRole: resolution.approverRole };
  }

  async act(input: ActInput): Promise<{ instanceId: string; instanceState: string; taskState: string }> {
    const task = await this.prisma.approvalTask.findUnique({
      where: { id: input.taskId },
      include: { instance: true },
    });
    if (!task || task.tenantId !== input.tenantId) throw new NotFoundException("task not found");
    const instance = task.instance;
    if (instance.state !== "pending") throw new RangeError(`instance is ${instance.state}`);

    const entry = matrixFor(this.matrix, instance.action);
    const delegated = await this.findDelegation(input.tenantId, input.actorUserId, instance.action);
    const verdict = mayAct(
      { assignedRole: task.assignedRole, assignedUserId: task.assignedUserId, state: task.state as never, slaDue: task.slaDue },
      { userId: input.actorUserId, roles: input.actorRoles },
      { escalateToRole: entry.escalateToRole, delegated },
    );
    if (!verdict.allowed) {
      throw new ForbiddenException({ title: "Forbidden", errors: [`act: ${verdict.reason}`] });
    }

    const nextTaskState = applyTaskDecision(task.state as never, input.decision);
    await this.prisma.approvalTask.update({
      where: { id: task.id },
      data: {
        state: nextTaskState,
        decidedBy: input.actorUserId,
        decision: input.decision,
        comment: input.comment,
        decidedAt: new Date(),
      },
    });

    // Sequential maker-checker (09 §2): first approval spawns the checker task.
    if (nextTaskState === "approved" && task.sequence === 1 && entry.checkerRole) {
      const checker = await this.prisma.approvalTask.create({
        data: {
          tenantId: input.tenantId,
          instanceId: instance.id,
          sequence: 2,
          state: "pending",
          assignedRole: entry.checkerRole,
          slaDue: slaDue(new Date(), entry.slaMinutes),
        },
      });
      return { instanceId: instance.id, instanceState: "pending", taskState: checker.state };
    }

    if (nextTaskState === "approved") {
      await this.transitionInstance(instance.id, "final-approve");
      await this.writeAudit(input.tenantId, instance, input.actorUserId, "approved", input.comment);
      return { instanceId: instance.id, instanceState: "approved", taskState: "approved" };
    }
    if (nextTaskState === "rejected") {
      await this.transitionInstance(instance.id, "reject");
      await this.writeAudit(input.tenantId, instance, input.actorUserId, "rejected", input.comment);
      return { instanceId: instance.id, instanceState: "rejected", taskState: "rejected" };
    }
    return { instanceId: instance.id, instanceState: instance.state, taskState: nextTaskState };
  }

  async myTasks(tenantId: string, actor: { userId: string; roles: string[] }): Promise<unknown[]> {
    const rows = await this.prisma.approvalTask.findMany({
      where: { tenantId, state: { in: ["pending", "query", "escalated"] }, assignedRole: { in: actor.roles } },
      orderBy: { slaDue: "asc" },
      include: { instance: { select: { action: true, valuePaise: true, payload: true } } },
    });
    // OWN-assignment and delegated tasks are resolved by role filter v1; per-user
    // assignment lands with the WP-0D DataScope store.
    return rows;
  }

  private async findDelegation(tenantId: string, userId: string, action: string): Promise<boolean> {
    const now = new Date();
    const d = await this.prisma.delegation.findFirst({
      where: { tenantId, toUserId: userId, actionClasses: { has: action }, validFrom: { lte: now }, validTo: { gte: now } },
    });
    return !!d;
  }

  private async transitionInstance(instanceId: string, event: "final-approve" | "reject"): Promise<void> {
    const instance = await this.prisma.workflowInstance.findUnique({ where: { id: instanceId } });
    if (!instance) throw new NotFoundException("instance vanished");
    const next = applyInstanceStateTransition(instance.state as never, event);
    await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { state: next } });
  }

  private async writeAudit(
    tenantId: string,
    instance: { id: string; action: string },
    actorUserId: string,
    outcome: string,
    comment?: string,
  ): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorUserId,
        actorKind: "human",
        action: `workflow.${instance.action}.${outcome}`,
        entityType: "workflow_instance",
        entityId: instance.id,
        after: { outcome, comment },
      },
    });
  }
}
