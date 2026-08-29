import { describe, expect, it } from "vitest";
import { Money, formatPaise, roundPaiseHalfUp } from "./money.js";

describe("Money", () => {
  it("rounds half-up to paise", () => {
    expect(roundPaiseHalfUp("22222.5")).toBe(22223n);
    expect(roundPaiseHalfUp("22222.4")).toBe(22222n);
    expect(roundPaiseHalfUp("0.5")).toBe(1n);
    expect(roundPaiseHalfUp("0.4999")).toBe(0n);
    expect(roundPaiseHalfUp("-1.5")).toBe(-2n);
  });

  it("converts rupees half-up", () => {
    expect(Money.fromRupees("123.456").paise).toBe(12346n);
    expect(Money.fromRupees(0.005).paise).toBe(1n);
    expect(Money.fromRupees("1500").paise).toBe(150000n);
  });

  it("rejects negatives (refunds are positive Money)", () => {
    expect(() => Money.fromPaise(-1)).toThrow(RangeError);
    expect(() => Money.fromRupees("-1")).toThrow(RangeError);
    expect(() => Money.zero().sub(Money.fromPaise(1))).toThrow(RangeError);
  });

  it("adds and subtracts exactly", () => {
    const a = Money.fromRupees("1234.56");
    const b = Money.fromRupees("765.44");
    expect(a.add(b).formatIndian()).toBe("2,000.00");
    expect(a.add(b).sub(b).eq(a)).toBe(true);
  });

  it("multiplies by quantity with half-up", () => {
    expect(Money.fromPaise(105n).multiply("1.005").paise).toBe(106n); // 105.525 -> 106
    expect(Money.fromPaise(3333n).multiply(3).paise).toBe(9999n);
  });

  it("computes percentages half-up", () => {
    expect(Money.fromPaise(123456n).percent(18).paise).toBe(22222n); // 22222.08
    expect(Money.fromPaise(100n).percent(5).paise).toBe(5n);
    expect(Money.fromPaise(10n).percent(15).paise).toBe(2n); // 1.5 -> 2
  });

  it("allocates with largest remainder so parts sum exactly", () => {
    const parts = Money.fromPaise(100n).allocate([1, 1, 1]);
    expect(parts.map((p) => p.paise)).toEqual([34n, 33n, 33n]);
    expect(Money.sum(parts).paise).toBe(100n);
    const two = Money.fromRupees("10.01").allocate([50, 50]);
    expect(Money.sum(two).formatIndian()).toBe("10.01");
  });

  it("formats Indian grouping", () => {
    expect(formatPaise(12345678n)).toBe("1,23,456.78");
    expect(formatPaise(1234567890n)).toBe("1,23,45,678.90");
    expect(formatPaise(789n)).toBe("7.89");
    expect(formatPaise(0n)).toBe("0.00");
    expect(formatPaise(-1234567890n)).toBe("-1,23,45,678.90");
  });

  it("formats short lakh/crore", () => {
    expect(Money.fromRupees("12300000").toShort()).toBe("₹1.23 Cr");
    expect(Money.fromRupees("456000").toShort()).toBe("₹4.56 L");
    expect(Money.fromRupees("7890").toShort()).toBe("₹7,890.00");
  });

  it("JSON round-trips through string paise", () => {
    const m = Money.fromRupees("99999999.99");
    expect(Money.fromJSON(JSON.parse(JSON.stringify(m.toJSON()))).eq(m)).toBe(true);
  });

  it("compares and picks min/max", () => {
    const a = Money.fromRupees(10);
    const b = Money.fromRupees(20);
    expect(Money.min(a, b).eq(a)).toBe(true);
    expect(Money.max(a, b).eq(b)).toBe(true);
    expect(a.lte(b)).toBe(true);
    expect(b.gt(a)).toBe(true);
  });
});
