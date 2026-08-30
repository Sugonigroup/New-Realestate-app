import { PrismaClient } from "@prisma/client";
import type { RunRecord } from "@buildos/core-api";

/**
 * Persists agent run records into agent_runs / ai_decisions / ai_actions
 * (05 §2 audit shapes) — the traceability contract for every AI action.
 */
export class AgentRunRecorder {
  constructor(private readonly prisma: PrismaClient) {}

  async record(run: RunRecord, model: string, promptVersion: string): Promise<string> {
    const agentRun = await this.prisma.agentRun.create({
      data: {
        tenantId: run.tenantId,
        agentCode: run.agentCode,
        triggerType: run.triggerType,
        triggerEventId: run.triggerEventId,
        model,
        promptVersion,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        status: run.status,
        traceId: run.traceId,
      },
    });

    for (const decision of run.decisions) {
      const d = await this.prisma.aiDecision.create({
        data: {
          tenantId: run.tenantId,
          runId: agentRun.id,
          observation: decision.observation as object,
          risk: decision.risk as unknown as object,
          recommendation: decision.recommendation as unknown as object,
          actionType: decision.actionType,
          actionPayload: decision.actionPayload as unknown as object,
          confidence: decision.confidence,
          evidence: decision.evidence as unknown as object,
        },
      });
      for (const action of run.actions.filter((a: { decisionId: string; tool: string; args: Record<string, unknown>; status: string; idempotencyKey: string; executedAt?: Date }) => a.decisionId === decision.decisionId)) {
        await this.prisma.aiAction.create({
          data: {
            tenantId: run.tenantId,
            decisionId: d.id,
            toolName: action.tool,
            toolArgs: action.args as unknown as object,
            autonomyLevel: decision.policyVerdict.level ?? 0,
            policyVerdict: decision.policyVerdict as unknown as object,
            executionStatus: action.status,
            idempotencyKey: action.idempotencyKey,
            executedAt: action.executedAt,
          },
        });
      }  }
    return agentRun.id;
  }
}
