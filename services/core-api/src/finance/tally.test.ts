import { describe, expect, it } from "vitest";
import { buildVoucher, controlTotals, assertPeriodOpen, PeriodLockedError, UnbalancedVoucherError } from "./tally.js";

const balanced = {
  type: "receipt" as const,
  date: "2026-09-05",
  voucherNo: "RCPT-000042",
  partyLedger: "Ravi Kumar",
  narration: "against demand DMND-000007",
  lines: [
    { ledger: "Ravi Kumar", debitPaise: 105_000_00n, creditPaise: 0n },
    { ledger: "Escrow A/c — Verde", debitPaise: 0n, creditPaise: 105_000_00n },
  ],
};

describe("Tally voucher builder (WP-2E, ADR-04)", () => {
  it("builds a balanced receipt voucher with XML envelope", () => {
    const { voucher, xml } = buildVoucher(balanced);
    expect(voucher.controlTotalPaise).toBe(105_000_00n);
    expect(xml).toContain("<VOUCHERTYPENAME>receipt</VOUCHERTYPENAME>");
    expect(xml).toContain("Ravi Kumar");
    expect(xml).toContain("10500000"); // signed amount convention (Tally-native)
  });

  it("refuses unbalanced vouchers (debits ≠ credits)", () => {
    expect(() =>
      buildVoucher({
        ...balanced,
        lines: [
          { ledger: "Ravi Kumar", debitPaise: 100n, creditPaise: 0n },
          { ledger: "Escrow", debitPaise: 0n, creditPaise: 50n },
        ],
      }),
    ).toThrow(UnbalancedVoucherError);
  });

  it("refuses empty vouchers", () => {
    expect(() => buildVoucher({ ...balanced, lines: [] })).toThrow(UnbalancedVoucherError);
  });

  it("control totals aggregate a sync batch", () => {
    const a = buildVoucher(balanced).voucher;
    const b = buildVoucher({ ...balanced, voucherNo: "RCPT-000043", lines: [
      { ledger: "Priya Singh", debitPaise: 50_000_00n, creditPaise: 0n },
      { ledger: "Escrow A/c — Verde", debitPaise: 0n, creditPaise: 50_000_00n },
    ] }).voucher;
    expect(controlTotals([a, b])).toEqual({ totalPaise: 155_000_00n, count: 2 });
  });

  it("period lock blocks closed periods", () => {
    expect(() => assertPeriodOpen("2026-09-05", "2026-08-31")).not.toThrow();
    expect(() => assertPeriodOpen("2026-08-31", "2026-08-31")).toThrow(PeriodLockedError);
    expect(() => assertPeriodOpen("2026-08-01", "2026-08-31")).toThrow(PeriodLockedError);
    expect(() => assertPeriodOpen("2026-09-05", null)).not.toThrow();
  });
});
