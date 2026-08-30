import { describe, expect, it } from "vitest";
import { mape, meetsPromotionGate, scoreClassification, type PredictionOutcome } from "./backtest.js";
import { forecastShortages, type MaterialPosition } from "./agents/material-intelligence.js";
import { analyzeDelay } from "./agents/cores.js";

describe("classification scoring (backtest primitives)", () => {
  it("computes precision/recall/F1", () => {
    const outcomes: PredictionOutcome[] = [
      { predicted: true, actual: true },
      { predicted: true, actual: true },
      { predicted: true, actual: false },
      { predicted: false, actual: true },
      { predicted: false, actual: false },
    ];
    expect(scoreClassification(outcomes)).toMatchObject({
      truePositives: 2, falsePositives: 1, falseNegatives: 1,
      precision: 0.6667, recall: 0.6667, f1: 0.6667,
    });
  });

  it("handles empty and all-negative sets without NaN", () => {
    expect(scoreClassification([])).toMatchObject({ precision: 0, recall: 0, f1: 0 });
    expect(scoreClassification([{ predicted: false, actual: false }]).precision).toBe(0);
  });

  it("promotion gate: precision ≥ 0.8 and recall ≥ 0.6", () => {
    expect(meetsPromotionGate({ truePositives: 8, falsePositives: 2, falseNegatives: 2, precision: 0.8, recall: 0.8, f1: 0.8 })).toBe(true);
    expect(meetsPromotionGate({ truePositives: 8, falsePositives: 4, falseNegatives: 1, precision: 0.6667, recall: 0.8889, f1: 0.7619 })).toBe(false);
  });
});

describe("MAPE for numeric forecasts", () => {
  it("computes mean absolute percentage error", () => {
    // (10% + 10% + 0%) / 3
    expect(mape([110, 90, 100], [100, 100, 100])).toBe(6.6667);
    // zero-actual entries are skipped (undefined percentage, never divide by zero)
    expect(mape([50, 90], [0, 100])).toBe(10);
    expect(mape([], [])).toBe(0);
  });

  it("rejects length mismatch", () => {
    expect(() => mape([1], [1, 2])).toThrow(RangeError);
  });
});

describe("shortage forecast replay (Phase 8 gate)", () => {
  const position = (over: Partial<MaterialPosition>): MaterialPosition => ({
    materialId: "m", materialName: "Mat", stockQty: 100, avgDailyConsumption: 10,
    inboundPoQty: 0, leadTimeDays: 7, safetyDays: 3, unit: "unit", ...over,
  });

  it("replays a mixed history and clears the promotion gate", () => {
    // history: 5 materials, actual outcomes known
    const history: Array<{ pos: MaterialPosition; actuallyStockedOut: boolean }> = [
      { pos: position({ materialId: "m1", stockQty: 50, avgDailyConsumption: 10, leadTimeDays: 7, safetyDays: 3 }), actuallyStockedOut: true }, // 5d cover < 10d → predicted ✓
      { pos: position({ materialId: "m2", stockQty: 200, avgDailyConsumption: 10, leadTimeDays: 7, safetyDays: 3 }), actuallyStockedOut: false }, // 20d cover → not predicted ✓
      { pos: position({ materialId: "m3", stockQty: 80, avgDailyConsumption: 10, leadTimeDays: 7, safetyDays: 3 }), actuallyStockedOut: true }, // 8d cover < 10d → predicted ✓
      { pos: position({ materialId: "m4", stockQty: 300, avgDailyConsumption: 10, leadTimeDays: 7, safetyDays: 3 }), actuallyStockedOut: false }, // 30d ✓
      { pos: position({ materialId: "m5", stockQty: 85, avgDailyConsumption: 10, leadTimeDays: 7, safetyDays: 3 }), actuallyStockedOut: true }, // 8.5d cover < 10d → predicted ✓
    ];
    const outcomes: PredictionOutcome[] = history.map(({ pos, actuallyStockedOut }) => ({
      predicted: forecastShortages({ positions: [pos], horizonDays: 30 }).length > 0,
      actual: actuallyStockedOut,
    }));
    const score = scoreClassification(outcomes);
    expect(score.truePositives).toBe(3);
    expect(score.falsePositives).toBe(0);
    expect(meetsPromotionGate(score)).toBe(true);

    // a noisy history with a false positive fails the precision gate
    const noisy = scoreClassification([...outcomes, { predicted: true, actual: false }]);
    expect(meetsPromotionGate(noisy)).toBe(false); // precision drops to 0.75
  });
});

describe("delay prediction replay", () => {
  const base = [
    { id: "A", durationDays: 3, deps: [] },
    { id: "B", durationDays: 5, deps: ["A"] },
    { id: "D", durationDays: 4, deps: ["B"] },
  ];

  it("MAPE of predicted vs actual schedule impact on the golden network", () => {
    const delays = [1, 2, 4, 8];
    const predicted: number[] = [];
    const actual: number[] = [];
    for (const d of delays) {
      // B is critical → 1:1 impact; simulate actual = predicted (perfect model on golden net)
      const out = analyzeDelay({ activities: base, baselineDuration: 12, delayedActivityId: "B", delayDays: d });
      predicted.push(out.risk.scheduleImpactDays ?? 0);
      actual.push(d); // on a pure critical path the impact equals the delay
    }
    expect(mape(predicted, actual)).toBe(0);
  });
});
