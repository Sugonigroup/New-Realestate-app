import { Money } from "@buildos/money-utils";
import { outstandingPaise, type OpenDemand } from "./allocation.js";

/**
 * Interest on delayed payments (FR-7.1): simple interest, computed on the
 * outstanding principal for the days late, half-up to the paise. The rate is
 * AFT-configurable and capped (RERA prescribes the maximum — BR-A/E).
 */

export interface InterestInput {
  demand: OpenDemand;
  rateBps: number; // annual, e.g. 1025 = 10.25%
  capBps?: number; // RERA cap; rate is min(rate, cap)
  asOf: Date; // interest computed up to this date
}

export interface InterestResult {
  interest: Money;
  daysLate: number;
  rateAppliedBps: number;
  outstanding: Money;
}

export function computeInterest(input: InterestInput): InterestResult {
  const { demand } = input;
  const rateAppliedBps = input.capBps !== undefined ? Math.min(input.rateBps, input.capBps) : input.rateBps;
  const outstanding = Money.fromPaise(outstandingPaise(demand));
  if (outstanding.isZero() || !demand.dueDate) {
    return { interest: Money.zero(), daysLate: 0, rateAppliedBps, outstanding };
  }
  const msLate = input.asOf.getTime() - demand.dueDate.getTime();
  const daysLate = msLate <= 0 ? 0 : Math.floor(msLate / 86_400_000);
  if (daysLate === 0) return { interest: Money.zero(), daysLate: 0, rateAppliedBps, outstanding };

  const p = outstanding.paise * BigInt(rateAppliedBps) * BigInt(daysLate);
  const denom = 10_000n * 365n;
  const interest = Money.fromPaise(p / denom + ((p % denom) * 2n >= denom ? 1n : 0n));
  return { interest, daysLate, rateAppliedBps, outstanding };
}
