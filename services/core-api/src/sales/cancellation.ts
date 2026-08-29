import { Money } from "@buildos/money-utils";

/**
 * Cancellation / forfeiture math (WP-1D, BR-3B + RERA Section 18, `01 §M3.7`).
 * Policy matrix is data; interest computation is deterministic paise (half-up).
 */

export type CancelInitiator = "customer" | "builder";

export interface ForfeiturePolicy {
  initiator: CancelInitiator;
  stage: "pre_aft" | "post_aft" | "post_possession";
  /** percent of amount paid that the builder retains */
  forfeitPctOfPaid: number;
  /** RERA interest applies on the refundable amount (builder-default cases) */
  interestBps?: number;
}

/** Seeded policy (tenant-configurable; builder defaults are RERA-constrained). */
export const FORFEITURE_POLICY: ForfeiturePolicy[] = [
  { initiator: "customer", stage: "pre_aft", forfeitPctOfPaid: 10 },
  { initiator: "customer", stage: "post_aft", forfeitPctOfPaid: 15 },
  { initiator: "customer", stage: "post_possession", forfeitPctOfPaid: 20 },
  { initiator: "builder", stage: "pre_aft", forfeitPctOfPaid: 0, interestBps: 1025 },
  { initiator: "builder", stage: "post_aft", forfeitPctOfPaid: 0, interestBps: 1025 },
  { initiator: "builder", stage: "post_possession", forfeitPctOfPaid: 0, interestBps: 1025 },
];

export interface CancellationInput {
  paidPaise: bigint;
  initiator: CancelInitiator;
  stage: "pre_aft" | "post_aft" | "post_possession";
  /** days the builder is late (builder-default interest base) */
  builderDelayDays?: number;
  policy?: ForfeiturePolicy[];
}

export interface CancellationResult {
  forfeit: Money;
  interest: Money;
  refund: Money;
  policy: ForfeiturePolicy;
  notes: string[];
}

export function computeCancellation(input: CancellationInput): CancellationResult {
  const policy =
    (input.policy ?? FORFEITURE_POLICY).find(
      (p) => p.initiator === input.initiator && p.stage === input.stage,
    ) ?? null;
  if (!policy) throw new RangeError(`no forfeiture policy for ${input.initiator}/${input.stage}`);

  const paid = Money.fromPaise(input.paidPaise);
  const notes: string[] = [];
  const forfeit = paid.percent(policy.forfeitPctOfPaid);
  if (policy.forfeitPctOfPaid > 0) notes.push(`forfeiture ${policy.forfeitPctOfPaid}% of paid`);

  let refund = paid.sub(forfeit);
  let interest = Money.zero();
  if (policy.interestBps && input.builderDelayDays && input.builderDelayDays > 0) {
    // simple interest: paid × bps/10000 × days/365, half-up per annum slice
    const p = paid.paise * BigInt(policy.interestBps) * BigInt(input.builderDelayDays);
    const denom = 10_000n * 365n;
    interest = Money.fromPaise(p / denom + ((p % denom) * 2n >= denom ? 1n : 0n));
    refund = refund.add(interest);
    notes.push(`RERA interest @${policy.interestBps / 100}% p.a. for ${input.builderDelayDays} days (Section 18)`);
  }
  if (input.initiator === "builder") notes.push("builder default — refundable amount + prescribed interest (RERA s.18)");
  return { forfeit, interest, refund, policy, notes };
}
