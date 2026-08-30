import { Money } from "@buildos/money-utils";

/** Sales incentive engine (WP-4G, FR-9.4): per-unit flat/pct, slabs, clawback. */

export interface IncentiveScheme {
  kind: "per_unit_flat" | "pct_of_value" | "slab_on_count";
  /** per_unit_flat: flat paise per booked unit; pct_of_value: bps on agreement value */
  flatPaise?: bigint;
  rateBps?: number;
  /** slab_on_count: units booked in scheme period → tiered flat paise per unit */
  countSlabs?: Array<{ uptoUnits: number; perUnitPaise: bigint }>;
  clawbackWindowDays: number;
}

export interface IncentiveEvent {
  bookingId: string;
  bookedAt: Date;
  cancelledAt?: Date | null;
  agreementValuePaise: bigint;
}

export interface IncentiveResult {
  payablePaise: bigint;
  clawbackPaise: bigint;
  perBooking: Array<{ bookingId: string; earned: bigint; clawed: boolean }>;
}

/** Clawback: bookings cancelled within the scheme window earn nothing (BR-H). */
export function computeIncentives(scheme: IncentiveScheme, events: IncentiveEvent[], asOf: Date): IncentiveResult {
  const live = events.filter((e) => e.cancelledAt === null || e.cancelledAt === undefined);
  const clawedCount = events.filter(
    (e) => e.cancelledAt !== null && e.cancelledAt !== undefined && e.cancelledAt.getTime() - e.bookedAt.getTime() <= scheme.clawbackWindowDays * 86_400_000,
  ).length;

  let earnedFn: (e: IncentiveEvent, index: number, liveCount: number) => bigint;
  if (scheme.kind === "per_unit_flat") {
    const flat = scheme.flatPaise ?? 0n;
    earnedFn = () => flat;
  } else if (scheme.kind === "pct_of_value") {
    const bps = scheme.rateBps ?? 0;
    earnedFn = (e) => Money.fromPaise(e.agreementValuePaise).percent(bps / 100).paise;
  } else {
    const slabs = [...(scheme.countSlabs ?? [])].sort((a, b) => a.uptoUnits - b.uptoUnits);
    earnedFn = (_e, index, liveCount) => {
      const unitsSoFar = index + 1; // sequential per scheme period
      void liveCount;
      const tier = slabs.find((s) => unitsSoFar <= s.uptoUnits) ?? slabs.at(-1);
      return tier?.perUnitPaise ?? 0n;
    };
  }

  const perBooking = events.map((e, index) => {
    const clawed =
      e.cancelledAt !== null &&
      e.cancelledAt !== undefined &&
      e.cancelledAt.getTime() - e.bookedAt.getTime() <= scheme.clawbackWindowDays * 86_400_000;
    const earned = clawed ? 0n : earnedFn(e, live.findIndex((l) => l.bookingId === e.bookingId), live.length);
    return { bookingId: e.bookingId, earned, clawed };
  });
  void clawedCount;

  return {
    payablePaise: perBooking.reduce((s, p) => s + p.earned, 0n),
    clawbackPaise: 0n,
    perBooking,
  };
}

/** CLRA compliance gate (BR-I): contractor without a valid licence can't be paid. */
export function clraGate(licenceExpiry: Date | null, now: Date): { ok: boolean; reason?: string } {
  if (!licenceExpiry) return { ok: false, reason: "CLRA licence on record required" };
  if (licenceExpiry.getTime() < now.getTime()) return { ok: false, reason: "CLRA licence expired" };
  return { ok: true };
}
