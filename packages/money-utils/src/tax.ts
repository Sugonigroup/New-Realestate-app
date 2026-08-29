/**
 * Effective-dated tax rate tables (GST, TDS/TCS) — deterministic computation only.
 * Rate tables are configuration (BR-F/BR-G in `01-product-requirements.md §4`);
 * rates here are placeholders pending consultant sign-off — structure is the contract.
 */
import { Money } from "./money.js";

export interface TaxRate {
  /** basis points of the taxable value (e.g. 1800 = 18%) */
  rateBps: number;
  effectiveFrom: string; // ISO date (IST business layer)
  effectiveTo?: string; // exclusive
  label?: string;
}

/** Effective-dated rate table; overlapping ranges are rejected at insert. */
export class RateTable {
  private readonly rates: TaxRate[] = [];

  add(rate: TaxRate): this {
    const from = Date.parse(rate.effectiveFrom);
    const to = rate.effectiveTo ? Date.parse(rate.effectiveTo) : Infinity;
    if (Number.isNaN(from)) throw new TypeError(`invalid effectiveFrom: ${rate.effectiveFrom}`);
    if (to <= from) throw new TypeError("effectiveTo must be after effectiveFrom");
    for (const r of this.rates) {
      const rf = Date.parse(r.effectiveFrom);
      const rt = r.effectiveTo ? Date.parse(r.effectiveTo) : Infinity;
      if (from < rt && rf < to) {
        throw new RangeError(
          `rate overlap: [${r.effectiveFrom}..${r.effectiveTo ?? "∞"}] overlaps [${rate.effectiveFrom}..${rate.effectiveTo ?? "∞"}]`,
        );
      }
    }
    this.rates.push(rate);
    return this;
  }

  /** Rate in force on the given date. Throws when there is no coverage (never guesses). */
  get(onDate: string): TaxRate {
    const t = Date.parse(onDate);
    if (Number.isNaN(t)) throw new TypeError(`invalid date: ${onDate}`);
    const hit = this.rates.find((r) => {
      const f = Date.parse(r.effectiveFrom);
      const to = r.effectiveTo ? Date.parse(r.effectiveTo) : Infinity;
      return t >= f && t < to;
    });
    if (!hit) {
      throw new RangeError(`no rate effective on ${onDate} (coverage must be explicit)`);
    }
    return hit;
  }

  /** Convenience: tax amount on a base Money for the rate in force on `onDate`. */
  taxFor(base: import("./money.js").Money, onDate: string): import("./money.js").Money {
    const { rateBps } = this.get(onDate);
    return percentBps(base, rateBps);
  }
}

/** bps percent of base, half-up (works on Money without exposing floats). */
export function percentBps(base: Money, bps: number): Money {
  if (!Number.isInteger(bps) || bps < 0) throw new TypeError(`bps must be a non-negative integer: ${bps}`);
  const p = base.paise * BigInt(bps);
  const denom = 10_000n;
  const q = p / denom;
  const r2 = (p % denom) * 2n;
  return Money.fromPaise(q + (r2 >= denom ? 1n : 0n));
}

export interface GstBreakup {
  total: Money;
  cgst: Money;
  sgst: Money;
  igst: Money;
}

/**
 * GST split for a taxable value. Intra-state: CGST+SGST at rate/2 each (odd remainder
 * goes to CGST — deterministic and auditable). Inter-state: IGST at full rate.
 */
export function computeGst(base: Money, rateBps: number, intraState: boolean): GstBreakup {
  if (!Number.isInteger(rateBps) || rateBps < 0) throw new TypeError(`invalid rateBps: ${rateBps}`);
  if (intraState) {
    const half = rateBps / 2;
    const total = percentBps(base, rateBps);
    if (rateBps % 2 === 0) {
      const each = percentBps(base, half);
      return { total, cgst: each, sgst: total.sub(each), igst: Money.zero() };
    }
    // odd bps: never happens for standard GST slabs; still deterministic:
    const cgst = percentBps(base, Math.ceil(half));
    const sgst = total.sub(cgst);
    return { total, cgst, sgst, igst: Money.zero() };
  }
  return { total: percentBps(base, rateBps), cgst: Money.zero(), sgst: Money.zero(), igst: percentBps(base, rateBps) };
}

/** TDS/TCS on a gross value; returns the deducted amount (half-up). */
export function computeTds(gross: Money, rateBps: number): Money {
  return percentBps(gross, rateBps);
}
