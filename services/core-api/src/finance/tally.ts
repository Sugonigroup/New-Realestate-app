import { Money } from "@buildos/money-utils";

/** Tally voucher builder (WP-2E, ADR-04): balanced vouchers + control totals + period lock. */

export type VoucherType = "receipt" | "payment" | "journal" | "sales";

export interface VoucherLine {
  ledger: string;
  debitPaise: bigint;
  creditPaise: bigint;
}

export interface VoucherInput {
  type: VoucherType;
  date: string; // ISO
  voucherNo: string;
  partyLedger: string;
  narration?: string;
  lines: VoucherLine[]; // party line + ledger lines; debits must equal credits
}

export class UnbalancedVoucherError extends Error {}

export function buildVoucher(input: VoucherInput): { voucher: VoucherInput & { controlTotalPaise: bigint }; xml: string } {
  const debits = input.lines.reduce((s, l) => s + l.debitPaise, 0n);
  const credits = input.lines.reduce((s, l) => s + l.creditPaise, 0n);
  if (debits !== credits || debits === 0n) {
    throw new UnbalancedVoucherError(
      `voucher ${input.voucherNo} unbalanced: debits ₹${Money.fromPaise(debits).formatIndian()} vs credits ₹${Money.fromPaise(credits).formatIndian()}`,
    );
  }
  const voucher = { ...input, controlTotalPaise: debits };
  const linesXml = input.lines
    .map(
      (l) =>
        `  <ALLLEDGERENTRIES.LIST><LEDGERNAME>${l.ledger}</LEDGERNAME><ISDEEMEDPOSITIVE>${l.debitPaise > 0n ? "Yes" : "No"}</ISDEEMEDPOSITIVE><AMOUNT>${l.debitPaise > 0n ? l.debitPaise : -l.creditPaise}</AMOUNT></ALLLEDGERENTRIES.LIST>`,
    )
    .join("\n");
  const xml = `<ENVELOPE><VOUCHER><DATE>${input.date}</DATE><VOUCHERTYPENAME>${input.type}</VOUCHERTYPENAME><VOUCHERNUMBER>${input.voucherNo}</VOUCHERNUMBER><PARTYLEDGERNAME>${input.partyLedger}</PARTYLEDGERNAME><NARRATION>${input.narration ?? ""}</NARRATION>\n${linesXml}\n</VOUCHER></ENVELOPE>`;
  return { voucher, xml };
}

/** Control totals across a sync batch — mismatch blocks the push. */
export function controlTotals(vouchers: Array<{ controlTotalPaise: bigint }>): { totalPaise: bigint; count: number } {
  return { totalPaise: vouchers.reduce((s, v) => s + v.controlTotalPaise, 0n), count: vouchers.length };
}

export class PeriodLockedError extends Error {}

/** Period lock (FR-7.10): no voucher syncs into a closed accounting period. */
export function assertPeriodOpen(date: string, lockedThrough: string | null): void {
  if (lockedThrough && new Date(date).getTime() <= new Date(lockedThrough).getTime()) {
    throw new PeriodLockedError(`accounting period locked through ${lockedThrough}`);
  }
}
