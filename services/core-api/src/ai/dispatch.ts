import { AgentRuntime, type AgentComputation, type RunRecord } from "./runtime.js";
import { verifyBill, type BillVerificationInput } from "./agents/billing-verification.js";
import { forecastShortages, type MaterialPosition } from "./agents/material-intelligence.js";
import { analyzeDelay, analyzeCostBreach, assembleDailyBrief } from "./agents/cores.js";
import { draftNcr, planIncidentCapa, contractorScorecard, classifyDocument } from "./agents/cores2.js";
import type { Severity } from "./policy.js";

/**
 * Event dispatcher (Phase 7 wiring, 11 §3): routes outbox events to the agents
 * subscribed to them, building each computation from the event payload. The
 * runtime's policy gate still decides what may act — the dispatcher only routes.
 */

export interface DomainEvent {
  id: string;
  tenantId: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface DispatchResult {
  eventId: string;
  runs: RunRecord[];
  unrouted: boolean;
}

type ComputationBuilder = (event: DomainEvent) => AgentComputation | null;

/** Event → agent subscriptions (08 triggers) with payload-mapping builders. */
export const EVENT_ROUTES: Record<string, Record<string, ComputationBuilder>> = {
  "bill.submitted": {
    billing_verification_agent: (e) => {
      const p = e.payload as unknown as BillVerificationInput & { raBillId: string };
      const v = verifyBill(p);
      if (v.anomalies.length === 0 && v.recommendation === "approve") return null; // clean bills don't need AI action
      return {
        observation: { raBillId: p.raBillId, anomalies: v.anomalies },
        risk: { severity: v.anomalies.some((a) => a.kind !== "quantity_mismatch") ? 1 : 2, financialImpactPaise: p.billRatePaise * BigInt(Math.round(p.billQty)) },
        recommendation: `${v.recommendation}: ${v.anomalies.map((a) => a.kind).join(", ") || "clean"}`,
        actionType: "flag_bill_anomaly",
        actionPayload: { raBillId: p.raBillId, anomalies: v.anomalies, recommendation: v.recommendation },
        confidence: v.confidence,
        evidence: v.evidence.map((ev) => ({ type: "computation" as const, ref: ev.note })),
      };
    },
  },
  "stock_movement.created": {
    material_agent: (e) => {
      const positions = (e.payload.positions ?? []) as unknown as MaterialPosition[];
      const shortages = forecastShortages({ positions, horizonDays: 30 });
      const top = shortages[0];
      if (!top) return null;
      return {
        observation: { shortages },
        risk: { severity: top.daysToStockout <= 7 ? 1 : 2 },
        recommendation: `shortage: ${top.materialName} stockout in ${top.daysToStockout}d — draft PR for ${top.suggestedQty}`,
        actionType: "emit_event",
        actionPayload: { event: "material.shortage.predicted", materialId: top.materialId, suggestedQty: top.suggestedQty, shortageBy: top.shortageBy },
        confidence: top.confidence,
        evidence: [{ type: "computation", ref: `cover:${top.materialId}:${top.coverDays}d` }],
      };
    },
  },
  "activity.delayed": {
    schedule_agent: (e) => {
      const p = e.payload as unknown as { activities: Parameters<typeof analyzeDelay>[0]["activities"]; baselineDuration: number; delayedActivityId: string; delayDays: number };
      return analyzeDelay({ activities: p.activities, baselineDuration: p.baselineDuration, delayedActivityId: p.delayedActivityId, delayDays: p.delayDays });
    },
  },
  "actual_cost.posted": {
    cost_control_agent: (e) => {
      const p = e.payload as unknown as { bac: string; pv: string; ev: string; ac: string; projectId: string };
      return analyzeCostBreach({
        bac: BigInt(p.bac), pv: BigInt(p.pv), ev: BigInt(p.ev), ac: BigInt(p.ac), projectId: p.projectId,
      });
    },
  },
  "quality.ncr_created": {
    contractor_agent: (e) => {
      const p = e.payload as unknown as { contractorId: string; scores: { schedule: number; quality: number; safety: number; cost: number }; trend: "improving" | "stable" | "declining" };
      return contractorScorecard({ contractorId: p.contractorId, scores: p.scores, trend: p.trend });
    },
  },
  "safety.incident_created": {
    safety_agent: (e) => {
      const p = e.payload as unknown as { incidentId: string; projectId: string; severity: "near_miss" | "minor" | "major" | "fatal"; description: string };
      return planIncidentCapa({ incidentId: p.incidentId, projectId: p.projectId, severity: p.severity, description: p.description });
    },
  },
  "document.uploaded": {
    document_agent: (e) => {
      const p = e.payload as unknown as { documentId: string; filename: string; mimeType: string; hasFormFields: boolean };
      return classifyDocument(p);
    },
  },
};

export class EventDispatcher {
  constructor(private readonly runtime: AgentRuntime) {}

  async dispatch(event: DomainEvent): Promise<DispatchResult> {
    const routes = EVENT_ROUTES[event.type];
    if (!routes) return { eventId: event.id, runs: [], unrouted: true };

    const runs: RunRecord[] = [];
    for (const [agentCode, build] of Object.entries(routes)) {
      const computation = build(event);
      if (computation === null) continue;
      runs.push(
        await this.runtime.run({
          tenantId: event.tenantId,
          agentCode,
          triggerType: "event",
          triggerEventId: event.id,
          computation,
        }),
      );
    }
    // unrouted = no agent subscribes to this event type; subscribed-but-quiet is normal
    return { eventId: event.id, runs, unrouted: !routes };
  }
}

/** Severity helper re-exported for dispatch consumers. */
export type { Severity };
