import { daysOfCover } from "../../analytics/kpis.js";

/**
 * Material Intelligence Agent (08 #5) — deterministic shortage forecasting.
 * Consumes schedule-derived consumption and stock; drafts PRs at L2 (never POs).
 */

export interface MaterialPosition {
  materialId: string;
  materialName: string;
  stockQty: number;
  avgDailyConsumption: number; // from consumption history
  inboundPoQty: number; // open POs expected within horizon
  leadTimeDays: number;
  safetyDays: number;
  unit: string;
}

export interface ShortageForecast {
  materialId: string;
  materialName: string;
  coverDays: number;
  daysToStockout: number;
  shortageBy: Date;
  suggestedQty: number;
  confidence: number;
}

export interface ConsumptionForecastInput {
  positions: MaterialPosition[];
  horizonDays: number;
}

export function forecastShortages(input: ConsumptionForecastInput): ShortageForecast[] {
  const out: ShortageForecast[] = [];
  for (const p of input.positions) {
    const netDaily = Math.max(p.avgDailyConsumption - inboundRate(p, input.horizonDays), 0);
    const cover = daysOfCover(p.stockQty, p.avgDailyConsumption);
    const daysToStockout = netDaily > 0 ? Math.floor(p.stockQty / netDaily) : cover;
    const threshold = p.leadTimeDays + p.safetyDays;
    if (daysToStockout < threshold) {
      const suggestedQty = Math.ceil(netDaily * (p.leadTimeDays + p.safetyDays * 2) - p.stockQty);
      out.push({
        materialId: p.materialId,
        materialName: p.materialName,
        coverDays: cover,
        daysToStockout,
        shortageBy: new Date(Date.now() + daysToStockout * 86_400_000),
        suggestedQty: Math.max(suggestedQty, 0),
        confidence: netDaily > 0 ? 0.9 : 0.5, // no consumption → low confidence
      });
    }
  }
  return out.sort((a, b) => a.daysToStockout - b.daysToStockout);
}

function inboundRate(p: MaterialPosition, horizonDays: number): number {
  return p.inboundPoQty / Math.max(horizonDays, 1);
}

/** Schedule-derived requirement: consumption forecast from planned activities (deterministic). */
export function requirementFromSchedule(
  plannedActivities: Array<{ key: string; plannedQty: number }>,
  boqConsumptionPerActivity: Record<string, number>,
): number {
  return plannedActivities.reduce((sum, a) => sum + (boqConsumptionPerActivity[a.key] ?? 0) * a.plannedQty, 0);
}
