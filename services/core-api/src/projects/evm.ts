/** Earned Value Management (WP-3B, 11 §5) — pure formulas over integer paise. */

export interface EvmInput {
  bac: bigint; // budget at completion (paise)
  pv: bigint; // planned value to date
  ev: bigint; // earned value (budget × physical %)
  ac: bigint; // actual cost
}

export interface EvmResult {
  sv: bigint; // schedule variance = EV − PV
  cv: bigint; // cost variance = EV − AC
  spi: number; // EV / PV
  cpi: number; // EV / AC
  eac: bigint; // estimate at completion = AC + (BAC − EV)/CPI
  vac: bigint; // variance at completion = BAC − EAC
  tcpi: bigint; // to-complete performance index (scaled ×1e6)
  health: "on_track" | "amber" | "red";
}

const MILLION = 1_000_000n;

export function computeEvm(input: EvmInput): EvmResult {
  const { bac, pv, ev, ac } = input;
  if (bac <= 0n) throw new RangeError("BAC must be positive");
  const spi = pv === 0n ? 1 : Number((ev * MILLION) / pv) / 1e6;
  const cpi = ac === 0n ? 1 : Number((ev * MILLION) / ac) / 1e6;
  // EAC = AC + (BAC − EV)/CPI; with CPI = EV/AC this is the exact rational
  // AC + (BAC − EV)×AC/EV — no rounding drift from the displayed CPI.
  const eac =
    ev === 0n ? bac : ac + ((bac - ev) * ac) / ev;
  const vac = bac - eac;
  const tcpiNumerator = bac - ev;
  const tcpiDenominator = bac - ac;
  const tcpi = tcpiDenominator <= 0n ? MILLION : (tcpiNumerator * MILLION) / tcpiDenominator;

  const health = spi < 0.9 || cpi < 0.9 ? "red" : spi < 0.95 || cpi < 0.95 ? "amber" : "on_track";
  return { sv: ev - pv, cv: ev - ac, spi, cpi, eac, vac, tcpi, health };
}
