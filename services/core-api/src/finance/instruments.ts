import { Money } from "@buildos/money-utils";

/** Instrument validation (WP-2B): BR-K cash limit, instrument registry rules. */

export type Instrument = "gateway" | "nach" | "neft" | "rtgs" | "cheque" | "cash";

const CASH_LIMIT_PAISE = 200_000_00n; // ₹2,00,000 — Section 269ST (BR-K)

export interface InstrumentValidation {
  ok: boolean;
  reason?: string;
}

export function validateInstrument(instrument: Instrument, amount: Money, instrumentRef?: string): InstrumentValidation {
  if (amount.paise <= 0n) return { ok: false, reason: "amount must be positive" };
  if (instrument === "cash") {
    if (amount.paise > CASH_LIMIT_PAISE) {
      return { ok: false, reason: "cash above ₹2,00,000 not acceptable (Section 269ST / BR-K)" };
    }
  }
  const needsRef: Instrument[] = ["neft", "rtgs", "cheque", "nach"];
  if (needsRef.includes(instrument) && !instrumentRef) {
    return { ok: false, reason: `${instrument} requires an instrument reference (UTR/cheque no/mandate id)` };
  }
  return { ok: true };
}

/** Bounce charges on a cleared-then-failed instrument (policy: flat ₹500 + GST). */
export const BOUNCE_CHARGE_PAISE = 50_000n;
