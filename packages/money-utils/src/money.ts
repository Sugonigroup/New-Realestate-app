/**
 * Money value object — integer paise only (architecture rule: `docs/architecture/05 §4`,
 * `docs/architecture/04 §4`). LLMs and floats never produce Money; only these deterministic
 * primitives do. Rounding is always half-up (banker's rounding is rejected for statutory
 * tax visibility).
 */

export type Currency = "INR";

export interface MoneyJSON {
  paise: string; // string to stay JSON-safe for bigint
  currency: Currency;
}

const PAISE_PER_RUPEE = 100n;
const LAKH_RUPEES = 100_000n; // 1e5
const CRORE_RUPEES = 10_000_000n; // 1e7

/** Half-up rounding of a decimal string number of paise (e.g. "22222.5" -> 22223). */
export function roundPaiseHalfUp(decimal: string): bigint {
  const neg = decimal.startsWith("-");
  const s = neg ? decimal.slice(1) : decimal;
  const [intPart, fracPart = ""] = s.split(".");
  let result = BigInt(intPart || "0");
  // half-up: fraction >= 0.5 rounds up
  if ((fracPart[0] ?? "0") >= "5") result += 1n;
  return neg ? -result : result;
}

export class Money {
  private constructor(
    readonly paise: bigint,
    readonly currency: Currency = "INR",
  ) {
    if (paise < 0n) throw new RangeError("negative amounts are not representable; use refunds as positive Money");
    Object.freeze(this);
  }

  static fromPaise(paise: bigint | number): Money {
    const p = typeof paise === "bigint" ? paise : BigInt(Math.trunc(paise));
    if (p < 0n) throw new RangeError("negative amounts are not representable; use refunds as positive Money");
    return new Money(p);
  }

  /** From a decimal rupee amount (number or string). Half-up to paise. */
  static fromRupees(rupees: number | string): Money {
    const s = typeof rupees === "number" ? rupees.toFixed(6) : rupees.trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) throw new TypeError(`invalid rupee amount: ${rupees}`);
    const neg = s.startsWith("-");
    const [r = "0", pf = ""] = (neg ? s.slice(1) : s).split(".");
    const paise =
      pf.length <= 2
        ? BigInt(r) * PAISE_PER_RUPEE + BigInt(pf.padEnd(2, "0") || "0")
        : // shift the decimal point two places into the paise domain, then round half-up
          roundPaiseHalfUp(`${r}${pf.slice(0, 2)}.${pf.slice(2)}`);
    return new Money(neg ? -paise : paise);
  }

  static zero(): Money {
    return new Money(0n);
  }

  static fromJSON(j: MoneyJSON): Money {
    return new Money(BigInt(j.paise), j.currency);
  }

  toJSON(): MoneyJSON {
    return { paise: this.paise.toString(), currency: this.currency };
  }

  get rupees(): bigint {
    return this.paise / PAISE_PER_RUPEE;
  }

  isZero(): boolean {
    return this.paise === 0n;
  }

  private same(a: Money): void {
    if (a.currency !== this.currency) throw new TypeError("currency mismatch");
  }

  add(other: Money): Money {
    this.same(other);
    if (this.paise + other.paise < 0n) throw new RangeError("negative result not representable");
    return new Money(this.paise + other.paise);
  }

  sub(other: Money): Money {
    this.same(other);
    if (this.paise - other.paise < 0n) throw new RangeError("negative result not representable");
    return new Money(this.paise - other.paise);
  }

  /** Multiply by a plain quantity (not a percentage). Half-up to paise. */
  multiply(quantity: number | string): Money {
    const q = typeof quantity === "number" ? quantity.toString() : quantity.trim();
    if (!/^\d+(\.\d+)?$/.test(q)) throw new TypeError(`invalid quantity: ${quantity}`);
    const [qi, qf = ""] = q.split(".");
    const scale = 10n ** BigInt(qf.length);
    const product = this.paise * BigInt(qi + qf) / scale;
    const remainder = (this.paise * BigInt(qi + qf)) % scale * 2n;
    const rounded = product + (remainder >= scale ? 1n : 0n);
    return new Money(rounded);
  }

  /** Percentage of this amount (pct in percent units, e.g. 18 = 18%). Half-up. */
  percent(pct: number): Money {
    if (!Number.isFinite(pct) || pct < 0) throw new TypeError(`invalid percent: ${pct}`);
    // exact decimal math: paise * pct / 100, half-up
    const scaled = this.paise * BigInt(Math.round(pct * 1e6)); // pct in micro-units
    const hundred = 100n * 1_000_000n;
    const q = scaled / hundred;
    const r2 = ((scaled % hundred) * 2n);
    return new Money(q + (r2 >= hundred ? 1n : 0n));
  }

  /** Split into parts by weights using the largest-remainder method (sums exactly). */
  allocate(weights: number[]): Money[] {
    if (weights.length === 0) throw new RangeError("allocate needs weights");
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    if (totalWeight <= 0) throw new RangeError("weights must sum > 0");
    const exact = weights.map((w) => (this.paise * BigInt(w)) / BigInt(totalWeight));
    const floors = exact.map((v) => v);
    let remainder = this.paise - floors.reduce((a, b) => a + b, 0n);
    // largest fractional remainder first (stable by index)
    const fracs = weights
      .map((w, i) => ({ i, frac: (this.paise * BigInt(w)) % BigInt(totalWeight) }))
      .sort((a, b) => Number(b.frac - a.frac) || a.i - b.i);
    const bump = new Set<number>();
    for (const f of fracs) {
      if (remainder <= 0n) break;
      bump.add(f.i);
      remainder -= 1n;
    }
    return floors.map((v, i) => new Money(v + (bump.has(i) ? 1n : 0n)));
  }

  cmp(other: Money): -1 | 0 | 1 {
    this.same(other);
    return this.paise < other.paise ? -1 : this.paise > other.paise ? 1 : 0;
  }
  lt(o: Money) { return this.cmp(o) < 0; }
  lte(o: Money) { return this.cmp(o) <= 0; }
  gt(o: Money) { return this.cmp(o) > 0; }
  gte(o: Money) { return this.cmp(o) >= 0; }
  eq(o: Money) { return this.cmp(o) === 0; }
  static min(a: Money, b: Money): Money { return a.lte(b) ? a : b; }
  static max(a: Money, b: Money): Money { return a.gte(b) ? a : b; }
  static sum(parts: Money[]): Money {
    return parts.reduce((acc, m) => acc.add(m), Money.zero());
  }

  /** Indian grouping: 1,23,45,678.90 */
  formatIndian(): string {
    return formatPaise(this.paise);
  }

  /** Short form: ₹1.23 Cr / ₹4.56 L / ₹7,890 (2 decimals for Cr/L, plain for < 1 L). */
  toShort(): string {
    const r = this.paise / PAISE_PER_RUPEE;
    if (r >= CRORE_RUPEES) {
      const whole = r * 100n / CRORE_RUPEES;
      return `₹${formatDecimal(whole, 2)} Cr`;
    }
    if (r >= LAKH_RUPEES) {
      const whole = r * 100n / LAKH_RUPEES;
      return `₹${formatDecimal(whole, 2)} L`;
    }
    return `₹${formatPaise(this.paise)}`;
  }

  toString(): string {
    return `${this.currency} ${this.formatIndian()}`;
  }
}

/** Group paise into Indian number format with exactly 2 decimals. */
export function formatPaise(paise: bigint): string {
  const neg = paise < 0n;
  const abs = neg ? -paise : paise;
  const rupees = abs / PAISE_PER_RUPEE;
  const p = abs % PAISE_PER_RUPEE;
  const rs = rupees.toString();
  let grouped: string;
  if (rs.length <= 3) {
    grouped = rs;
  } else {
    const last3 = rs.slice(-3);
    let rest = rs.slice(0, -3);
    const chunks: string[] = [];
    while (rest.length > 2) {
      chunks.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) chunks.unshift(rest);
    grouped = `${chunks.join(",")},${last3}`;
  }
  const frac = p.toString().padStart(2, "0");
  return `${neg ? "-" : ""}${grouped}.${frac}`;
}

function formatDecimal(scaled: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const int = scaled / scale;
  const frac = (scaled % scale).toString().padStart(decimals, "0");
  return `${int.toString()}.${frac}`;
}
