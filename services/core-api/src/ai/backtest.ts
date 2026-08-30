/**
 * Backtesting harness (Phase 8, `25 §4`, `28`): replay historical outcomes
 * against the deterministic forecast cores and score them. Promotion gates
 * (shadow → L2 → L3) require the thresholds here to hold on the replay set.
 */

export interface PredictionOutcome {
  predicted: boolean;
  actual: boolean;
}

export interface ClassificationScore {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number; // TP / (TP + FP), 0 when undefined
  recall: number; // TP / (TP + FN), 0 when undefined
  f1: number;
}

export function scoreClassification(outcomes: PredictionOutcome[]): ClassificationScore {
  let tp = 0, fp = 0, fn = 0;
  for (const o of outcomes) {
    if (o.predicted && o.actual) tp += 1;
    else if (o.predicted && !o.actual) fp += 1;
    else if (!o.predicted && o.actual) fn += 1;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { truePositives: tp, falsePositives: fp, falseNegatives: fn, precision: round4(precision), recall: round4(recall), f1: round4(f1) };
}

/** Mean absolute percentage error for numeric forecasts (completion dates, EAC). */
export function mape(predicted: number[], actual: number[]): number {
  if (predicted.length !== actual.length) {
    throw new RangeError("predicted/actual length mismatch");
  }
  if (predicted.length === 0) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < predicted.length; i++) {
    if (actual[i] === 0) continue; // undefined percentage — skip, never divide by zero
    sum += Math.abs(predicted[i]! - actual[i]!) / Math.abs(actual[i]!);
    count += 1;
  }
  return count === 0 ? 0 : round4((sum / count) * 100);
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/** Promotion gate (27 Phase 8 exit): precision ≥ 0.8 and recall ≥ 0.6 for anomaly classes. */
export function meetsPromotionGate(score: ClassificationScore, minPrecision = 0.8, minRecall = 0.6): boolean {
  return score.precision >= minPrecision && score.recall >= minRecall;
}
