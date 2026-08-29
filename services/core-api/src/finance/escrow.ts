import { Money } from "@buildos/money-utils";

/**
 * RERA 70% escrow guard (BR-A, 12 §4):
 *  - 70% of receivables collected must remain in the designated account;
 *  - withdrawals are additionally capped by certified completion %:
 *      maxWithdrawn = certifiedPct × totalProjectCost
 *  - breach = withdrawn exceeds either bound.
 */

export const RERA_ESCROW_SHARE = 70n; // % of receivables that must be parked
const HUNDRED = 100n;

export interface EscrowState {
  collectedPaise: bigint; // all project receivables collected to date
  withdrawnPaise: bigint; // total already withdrawn
  certifiedPct: number; // latest certified completion (0–100)
  totalProjectCostPaise: bigint;
}

export interface WithdrawalGuard {
  allowed: boolean;
  reason: string;
  /** largest additional withdrawal satisfying both bounds */
  maxAdditionalPaise: bigint;
  /** 70%-of-collected currently still required to be parked */
  parkedRequiredPaise: bigint;
  withdrawnCapPaise: bigint; // certifiedPct × total cost
  breach: boolean;
}

export function evaluateWithdrawal(state: EscrowState, requestedPaise: bigint): WithdrawalGuard {
  if (state.certifiedPct < 0 || state.certifiedPct > 100) {
    throw new RangeError(`certifiedPct out of range: ${state.certifiedPct}`);
  }
  const parkedRequired = (state.collectedPaise * RERA_ESCROW_SHARE) / HUNDRED;
  const withdrawnCap = (state.totalProjectCostPaise * BigInt(Math.round(state.certifiedPct * 100))) / (HUNDRED * 100n);

  const spendable = state.collectedPaise - parkedRequired; // 30% side
  const byCertification = withdrawnCap - state.withdrawnPaise;
  const maxAdditional = spendable < byCertification ? (spendable > 0n ? spendable : 0n) : byCertification > 0n ? byCertification : 0n;

  const breach = state.withdrawnPaise > spendable || state.withdrawnPaise > withdrawnCap;
  const allowed = requestedPaise > 0n && requestedPaise <= maxAdditional;

  const reason = !allowed
    ? requestedPaise > maxAdditional
      ? `requested exceeds guard: max additional ₹${Money.fromPaise(maxAdditional).formatIndian()} (70% parked ₹${Money.fromPaise(parkedRequired).formatIndian()}, certified cap ₹${Money.fromPaise(withdrawnCap > 0n ? withdrawnCap : 0n).formatIndian()})`
      : "nothing withdrawable under the 70% rule"
    : "within guard";

  return { allowed, reason, maxAdditionalPaise: maxAdditional, parkedRequiredPaise: parkedRequired, withdrawnCapPaise: withdrawnCap, breach };
}

/** Classification of a cleared receipt: 70% parked, 30% spendable (projection). */
export function classifyReceipt(collectedPaise: bigint): { parkedPaise: bigint; spendablePaise: bigint } {
  if (collectedPaise < 0n) throw new RangeError("negative collection");
  const parked = (collectedPaise * RERA_ESCROW_SHARE) / HUNDRED;
  return { parkedPaise: parked, spendablePaise: collectedPaise - parked };
}
