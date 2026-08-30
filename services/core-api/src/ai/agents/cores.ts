import { computeCpm, type CpmActivity } from "../../projects/cpm.js";
import { computeEvm } from "../../projects/evm.js";
import { buildBoardPack, type PackSection } from "../../analytics/report-pack.js";
import type { AgentComputation } from "../runtime.js";
import type { Severity } from "../policy.js";

/**
 * Remaining deterministic agent cores (Phase 6). Each returns an AgentComputation
 * — observation/risk/recommendation/action — that the runtime routes through the
 * policy gate. All math is deterministic; LLM narrative wraps these outputs.
 */

// ── Schedule Agent: delay impact + recovery draft (08 #3, L2) ───────────────

export interface DelayInput {
  activities: CpmActivity[];
  baselineDuration: number;
  delayedActivityId: string;
  delayDays: number;
}

export interface DelayOutput extends AgentComputation {
  actionPayload: { impacted: string[]; newDuration: number; recoveryCandidates: string[]; delayDays: number };
}

export function analyzeDelay(input: DelayInput): DelayOutput {
  const impacted = input.activities.map((a) =>
    a.id === input.delayedActivityId ? { ...a, durationDays: a.durationDays + input.delayDays } : a,
  );
  const after = computeCpm(impacted);
  const newDuration = after.projectDuration;
  const delayedEs = after.nodes[input.delayedActivityId]?.es ?? 0;
  const impactedIds = Object.entries(after.nodes)
    .filter(([, n]) => n.es >= delayedEs)
    .map(([id]) => id);

  // recovery candidates: parallel (non-critical) activities whose float ≥ delay —
  // accelerating those protects the committed date without a baseline change
  const recoveryCandidates = Object.entries(after.nodes)
    .filter(([id, n]) => !n.critical && id !== input.delayedActivityId && n.float >= input.delayDays)
    .map(([id]) => id);

  const severity: Severity = newDuration - input.baselineDuration > 30 ? 1 : newDuration - input.baselineDuration > 7 ? 2 : 3;
  return {
    observation: {
      delayedActivity: input.delayedActivityId,
      delayDays: input.delayDays,
      newDuration,
      baselineDuration: input.baselineDuration,
      criticalPath: after.criticalPath,
    },
    risk: { severity, scheduleImpactDays: newDuration - input.baselineDuration },
    recommendation:
      newDuration > input.baselineDuration
        ? `baseline impact +${newDuration - input.baselineDuration}d — review recovery candidates with float`
        : "delay absorbed by existing float",
    actionType: "emit_event",
    actionPayload: { impacted: impactedIds, newDuration, recoveryCandidates, delayDays: input.delayDays },
    confidence: 0.92,
    evidence: [{ type: "computation", ref: `cpm:${input.delayedActivityId}+${input.delayDays}d` }],
  };
}

// ── Cost Control Agent: EAC breach detection (08 #8, L1 → L4 propose) ───────

export interface CostBreachInput {
  bac: bigint;
  pv: bigint;
  ev: bigint;
  ac: bigint;
  projectId: string;
}

export interface CostBreachOutput extends AgentComputation {}

export function analyzeCostBreach(input: CostBreachInput): CostBreachOutput {
  const evm = computeEvm({ bac: input.bac, pv: input.pv, ev: input.ev, ac: input.ac });
  const breached = evm.eac > input.bac;
  const overPct = Number(((evm.eac - input.bac) * 10_000n) / input.bac) / 100;
  const severity: Severity = overPct > 7 ? 1 : overPct > 3 ? 2 : 3;
  return {
    observation: { ...evm, eacFormatted: `₹${(Number(evm.eac) / 1e7).toFixed(2)} Cr`, bacFormatted: `₹${(Number(input.bac) / 1e7).toFixed(2)} Cr` },
    risk: { severity: breached ? severity : 3, financialImpactPaise: breached ? evm.eac - input.bac : 0n },
    recommendation: breached
      ? `EAC exceeds BAC by ${overPct.toFixed(1)}% — review cost drivers and propose budget revision`
      : "cost forecast within budget",
    actionType: breached ? "propose_budget_revision" : "emit_event",
    actionPayload: breached
      ? { projectId: input.projectId, eacPaise: evm.eac.toString(), overPct }
      : { eacPaise: evm.eac.toString() },
    confidence: 0.95,
    evidence: [{ type: "kpi", ref: `evm:spi${evm.spi.toFixed(2)}/cpi${evm.cpi.toFixed(2)}` }],
  };
}

// ── Management Intelligence Agent: daily brief assembly (08 #12, 13 §2) ─────

export interface BriefInput {
  generatedAt: Date;
  sections: PackSection[];
}

export interface BriefOutput extends AgentComputation {}

export function assembleDailyBrief(input: BriefInput): BriefOutput {
  const pack = buildBoardPack("CEO Daily Brief", input.sections, input.generatedAt);
  const riskRows = pack.sections.find((s) => s.title === "Risks")?.rows ?? [];
  const severity: Severity = riskRows.length >= 3 ? 1 : riskRows.length >= 1 ? 2 : 3;
  return {
    observation: { sections: pack.sections.map((s) => s.title), staleness: pack.stalenessFlagged },
    risk: { severity },
    recommendation:
      riskRows.length > 0
        ? `review ${riskRows.length} open risk(s) in today's brief`
        : "portfolio stable — no critical risks today",
    actionType: "generate_report",
    actionPayload: { pack },
    confidence: 0.99,
    evidence: [{ type: "kpi", ref: "board-pack:" + input.generatedAt.toISOString().slice(0, 10) }],
  };
}
