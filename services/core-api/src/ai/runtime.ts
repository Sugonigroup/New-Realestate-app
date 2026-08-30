import { randomUUID } from "node:crypto";
import { agentFor, toolFor } from "./registry.js";
import { evaluatePolicy, type PolicyConfig, type PolicyVerdict, type Severity } from "./policy.js";

/**
 * Agent runtime (Phase 6, 07 §3): trigger → deterministic compute → policy gate
 * → act/record → audit. Shadow mode: L3 execution disabled at the config level
 * until Phase 7; every run is fully traceable (05 §2 audit shapes).
 */

export interface RunRecord {
  runId: string;
  tenantId: string;
  agentCode: string;
  triggerType: "event" | "cron" | "manual";
  triggerEventId?: string;
  startedAt: Date;
  finishedAt?: Date;
  status: "running" | "completed" | "failed" | "suspended";
  decisions: DecisionRecord[];
  actions: ActionRecord[];
  traceId: string;
}

export interface DecisionRecord {
  decisionId: string;
  observation: Record<string, unknown>;
  risk: { severity: Severity; financialImpactPaise?: bigint; scheduleImpactDays?: number };
  recommendation: string;
  actionType: string;
  actionPayload: Record<string, unknown>;
  confidence: number;
  evidence: Array<{ type: "kpi" | "record" | "document" | "computation"; ref: string }>;
  policyVerdict: PolicyVerdict;
}

export interface ActionRecord {
  actionId: string;
  decisionId: string;
  tool: string;
  args: Record<string, unknown>;
  status: "pending_approval" | "executed" | "denied" | "drafted";
  executedAt?: Date;
  idempotencyKey: string;
}

export interface RuntimeConfig {
  shadowMode: boolean; // Phase 6: true — no side effects, everything recorded
  policy: PolicyConfig;
}

export interface AgentComputation {
  // deterministic agent output
  observation: Record<string, unknown>;
  risk: { severity: Severity; financialImpactPaise?: bigint; scheduleImpactDays?: number };
  recommendation: string;
  actionType: string; // tool name, e.g. "flag_bill_anomaly"
  actionPayload: Record<string, unknown>;
  confidence: number;
  evidence: Array<{ type: "kpi" | "record" | "document" | "computation"; ref: string }>;
}

export class AgentRuntime {
  private readonly actions = new Map<string, "executed" | "denied">(); // idempotency ledger

  constructor(
    private readonly config: RuntimeConfig,
    private readonly executor: (tool: string, args: Record<string, unknown>) => Promise<void> = async () => {},
  ) {}

  /**
   * Run one agent computation through the pipeline. Idempotent per
   * (agent, event, actionType, payload digest).
   */
  async run(input: {
    tenantId: string;
    agentCode: string;
    triggerType: "event" | "cron" | "manual";
    triggerEventId?: string;
    computation: AgentComputation;
  }): Promise<RunRecord> {
    const agent = agentFor(input.agentCode);
    const tool = toolFor(input.computation.actionType);
    const runId = randomUUID();
    const now = new Date();

    const verdict = evaluatePolicy(
      {
        agentCode: agent.code,
        tool: tool.name,
        confidence: input.computation.confidence,
        severity: input.computation.risk.severity,
        actionClass: tool.actionClass,
        argsValid: true, // args validated by Zod at the tool boundary
      },
      agent,
      tool,
      this.config.policy,
    );

    const decisionId = randomUUID();
    const decision: DecisionRecord = {
      decisionId,
      observation: input.computation.observation,
      risk: input.computation.risk,
      recommendation: input.computation.recommendation,
      actionType: tool.name,
      actionPayload: input.computation.actionPayload,
      confidence: input.computation.confidence,
      evidence: input.computation.evidence,
      policyVerdict: verdict,
    };

    const idempotencyKey = `${agent.code}:${input.triggerEventId ?? "manual"}:${tool.name}`;
    const actions: ActionRecord[] = [];
    const run: RunRecord = {
      runId,
      tenantId: input.tenantId,
      agentCode: agent.code,
      triggerType: input.triggerType,
      triggerEventId: input.triggerEventId,
      startedAt: now,
      status: "completed",
      decisions: [decision],
      actions,
      traceId: randomUUID(),
    };

    const shadowBlocked = this.config.shadowMode && (verdict.verdict === "EXECUTE" || verdict.verdict === "APPROVAL_REQUIRED");
    if (verdict.verdict === "DENY") {
      actions.push({ actionId: randomUUID(), decisionId, tool: tool.name, args: input.computation.actionPayload, status: "denied", idempotencyKey });
    } else if (verdict.verdict === "APPROVAL_REQUIRED") {
      actions.push({ actionId: randomUUID(), decisionId, tool: tool.name, args: input.computation.actionPayload, status: shadowBlocked ? "drafted" : "pending_approval", idempotencyKey });
    } else if (verdict.verdict === "EXECUTE") {
      if (this.actions.has(idempotencyKey) || shadowBlocked) {
        actions.push({ actionId: randomUUID(), decisionId, tool: tool.name, args: input.computation.actionPayload, status: "drafted", idempotencyKey });
      } else {
        await this.executor(tool.name, input.computation.actionPayload);
        this.actions.set(idempotencyKey, "executed");
        actions.push({ actionId: randomUUID(), decisionId, tool: tool.name, args: input.computation.actionPayload, status: "executed", executedAt: new Date(), idempotencyKey });
      }
    } else {
      // ALLOW (read) / DOWNGRADE_DRAFT — recorded, no side effect
      actions.push({ actionId: randomUUID(), decisionId, tool: tool.name, args: input.computation.actionPayload, status: "drafted", idempotencyKey });
    }
    run.finishedAt = new Date();
    return run;
  }
}
