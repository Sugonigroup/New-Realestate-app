import { Money } from "@buildos/money-utils";

/**
 * KPI framework (WP-5B, doc 14) — deterministic functions over structured
 * inputs; dashboards and agents consume these, never compute their own.
 */

// ── Collections ──────────────────────────────────────────────────────────────
export interface DemandRow {
  amountPaise: bigint;
  paidPaise: bigint;
  dueDate: Date | null;
}

export function collectionsKpi(demands: DemandRow[], now: Date): {
  demandedPaise: bigint; collectedPaise: bigint; collectedPct: number;
  overduePaise: bigint; aging: { b0_30: bigint; b31_60: bigint; b61_90: bigint; b90p: bigint };
} {
  const demanded = demands.reduce((s, d) => s + d.amountPaise, 0n);
  const collected = demands.reduce((s, d) => s + d.paidPaise, 0n);
  const overdue = demands.filter((d) => {
    const out = d.amountPaise - d.paidPaise;
    return out > 0n && d.dueDate !== null && d.dueDate.getTime() < now.getTime();
  });
  const bucket = (minDays: number, maxDays: number): bigint =>
    overdue
      .filter((d) => {
        const days = Math.floor((now.getTime() - d.dueDate!.getTime()) / 86_400_000);
        return days >= minDays && (maxDays === Infinity || days <= maxDays);
      })
      .reduce((s, d) => s + (d.amountPaise - d.paidPaise), 0n);
  return {
    demandedPaise: demanded,
    collectedPaise: collected,
    collectedPct: demanded > 0n ? Math.round((Number(collected) / Number(demanded)) * 10_000) / 100 : 0,
    overduePaise: overdue.reduce((s, d) => s + (d.amountPaise - d.paidPaise), 0n),
    aging: { b0_30: bucket(0, 30), b31_60: bucket(31, 60), b61_90: bucket(61, 90), b90p: bucket(91, Infinity) },
  };
}

// ── Procurement ──────────────────────────────────────────────────────────────
export interface PoRow {
  promisedDate: Date;
  receivedDate: Date | null;
  receivedInFull: boolean;
}

export function otif(pos: PoRow[]): number {
  if (pos.length === 0) return 0;
  const onTimeInFull = pos.filter((p) => p.receivedDate !== null && p.receivedInFull && p.receivedDate.getTime() <= p.promisedDate.getTime());
  return Number((BigInt(onTimeInFull.length) * 10_000n) / BigInt(pos.length)) / 100;
}

// ── Inventory ────────────────────────────────────────────────────────────────
export function daysOfCover(stockQty: number, avgDailyConsumption: number): number {
  if (avgDailyConsumption <= 0) return Infinity;
  return Math.round((stockQty / avgDailyConsumption) * 100) / 100;
}

export function wastagePct(consumedQty: number, certifiedOutputNormQty: number): number {
  if (consumedQty <= 0) return 0;
  const excess = consumedQty - certifiedOutputNormQty;
  return excess <= 0 ? 0 : Math.round((excess / consumedQty) * 10_000) / 100;
}

// ── Contractor composite score (11 §9) ──────────────────────────────────────
export interface ContractorScores {
  schedule: number; // 0–100
  quality: number;
  safety: number;
  cost: number;
}

export function contractorComposite(s: ContractorScores): { score: number; band: "A" | "B" | "C" | "D" } {
  const score = Math.round(s.schedule * 0.4 + s.quality * 0.3 + s.safety * 0.2 + s.cost * 0.1);
  return { score, band: score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D" };
}

// ── Quality / safety ─────────────────────────────────────────────────────────
export function qualityMetrics(input: { inspectionsDone: number; inspectionsPlanned: number; ncrsRaised: number; ncrsClosed: number; firstPassYieldPct: number }): {
  inspectionCompliancePct: number; ncrClosureRatePct: number; firstPassYieldPct: number;
} {
  const compliance = input.inspectionsPlanned > 0
    ? Math.round((input.inspectionsDone / input.inspectionsPlanned) * 10_000) / 100
    : 0;
  const closure = input.ncrsRaised > 0 ? Math.round((input.ncrsClosed / input.ncrsRaised) * 10_000) / 100 : 100;
  return { inspectionCompliancePct: compliance, ncrClosureRatePct: closure, firstPassYieldPct: input.firstPassYieldPct };
}

/** Safety frequency rate: incidents per 10⁵ man-hours (14 §7). */
export function safetyFrequencyRate(incidents: number, manHours: number): number {
  if (manHours <= 0) return 0;
  return Math.round(((incidents * 100_000) / manHours) * 100) / 100;
}

export { Money };
