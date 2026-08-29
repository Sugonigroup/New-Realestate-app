/** Dunning schedule (WP-2A): T-7 / T-3 / T-0 / T+7, each step fires exactly once. */

export type DunningStep = "T-7" | "T-3" | "T-0" | "T+7";

export const DUNNING_STEPS: DunningStep[] = ["T-7", "T-3", "T-0", "T+7"];

const STEP_OFFSET_DAYS: Record<DunningStep, number> = {
  "T-7": -7,
  "T-3": -3,
  "T-0": 0,
  "T+7": 7,
};

export function stepFireDate(dueDate: Date, step: DunningStep): Date {
  return new Date(dueDate.getTime() + STEP_OFFSET_DAYS[step] * 86_400_000);
}

export interface DunningEvaluation {
  dueSteps: DunningStep[]; // steps whose fire date has passed and not yet sent
  nextStep?: DunningStep;
}

/**
 * Idempotent: a step is due only when its date has passed AND it is later than
 * lastDunningStep. Steps with no due date (construction-linked) never run.
 */
export function evaluateDunning(demand: { dueDate: Date | null; lastDunningStep?: string | null }, now: Date): DunningEvaluation {
  if (!demand.dueDate) return { dueSteps: [] };
  const lastIdx = demand.lastDunningStep ? DUNNING_STEPS.indexOf(demand.lastDunningStep as DunningStep) : -1;
  const dueSteps: DunningStep[] = [];
  for (let i = lastIdx + 1; i < DUNNING_STEPS.length; i++) {
    const step = DUNNING_STEPS[i]!;
    if (stepFireDate(demand.dueDate, step).getTime() <= now.getTime()) {
      dueSteps.push(step);
    } else {
      break;
    }
  }
  const next = (() => {
    const nextIdx = dueSteps.length > 0 ? DUNNING_STEPS.indexOf(dueSteps[dueSteps.length - 1]!) + 1 : lastIdx + 1;
    return nextIdx < DUNNING_STEPS.length ? DUNNING_STEPS[nextIdx] : undefined;
  })();
  return { dueSteps, nextStep: next };
}
