import { Money } from "@buildos/money-utils";

/** Commission math (WP-1E, BR-H/BR-C): flat or progressive slab, TDS 194H, credit windows. */

export interface SlabTier {
  fromPaise: bigint; // inclusive
  toPaise: bigint | null; // exclusive, null = unlimited
  rateBps: number;
}

export interface CommissionPlanShape {
  kind: "flat" | "slab";
  rateBps: number;
  slabs?: SlabTier[];
  tdsBps: number;
}

/** Commission on a realized amount — progressive slabs (each tier on its slice). */
export function accrueCommission(plan: CommissionPlanShape, realized: Money): Money {
  if (plan.kind === "flat") return realized.percent(plan.rateBps / 100);
  const slabs = [...(plan.slabs ?? [])].sort((a, b) => (a.fromPaise < b.fromPaise ? -1 : 1));
  let commission = Money.zero();
  for (const tier of slabs) {
    const from = tier.fromPaise;
    const to = tier.toPaise ?? null;
    if (realized.lte(Money.fromPaise(from))) break;
    const upper = to !== null ? Money.min(realized, Money.fromPaise(to)) : realized;
    const slice = upper.sub(Money.fromPaise(from));
    if (!slice.isZero()) commission = commission.add(slice.percent(tier.rateBps / 100));
  }
  return commission;
}

/** TDS 194H on the gross commission (BR-H). */
export function tdsOnCommission(gross: Money, tdsBps: number): Money {
  return gross.percent(tdsBps / 100);
}

/** First-touch credit window (BR-3C/BR-C): partner credited only inside the window. */
export interface CreditDecisionInput {
  leadCreatedAt: Date;
  partnerImportedAt: Date;
  houseLeadCreatedAt: Date | null; // earlier house lead for the same phone
  windowDays: number;
}

export interface CreditDecision {
  creditedTo: "partner" | "house";
  reason: string;
}

export function creditDecision(input: CreditDecisionInput): CreditDecision {
  const withinWindow =
    input.leadCreatedAt.getTime() - input.partnerImportedAt.getTime() <= input.windowDays * 86_400_000;
  if (input.houseLeadCreatedAt !== null && input.houseLeadCreatedAt.getTime() <= input.partnerImportedAt.getTime()) {
    return { creditedTo: "house", reason: "earlier house lead owns the contact (first-touch)" };
  }
  if (!withinWindow) {
    return { creditedTo: "house", reason: `outside ${input.windowDays}-day credit window` };
  }
  return { creditedTo: "partner", reason: "partner import inside credit window, no earlier house lead" };
}
