import { describe, expect, it } from "vitest";
import { Money } from "./money.js";
import { RateTable, computeGst, computeTds } from "./tax.js";

describe("RateTable", () => {
  const table = new RateTable()
    .add({ rateBps: 100, effectiveFrom: "2024-04-01", effectiveTo: "2025-04-01", label: "affordable 1%" })
    .add({ rateBps: 500, effectiveFrom: "2025-04-01", label: "standard 5%" });

  it("returns the rate in force", () => {
    expect(table.get("2024-12-31").rateBps).toBe(100);
    expect(table.get("2025-04-01").rateBps).toBe(500); // effectiveTo is exclusive
  });

  it("throws when no rate covers the date (never guesses)", () => {
    expect(() => table.get("2024-03-31")).toThrow(RangeError);
    expect(() => table.get("2024-13-01")).toThrow(TypeError);
  });

  it("rejects overlapping ranges at insert", () => {
    const t = new RateTable().add({ rateBps: 500, effectiveFrom: "2025-01-01", effectiveTo: "2026-01-01" });
    expect(() => t.add({ rateBps: 100, effectiveFrom: "2025-06-01" })).toThrow(RangeError);
  });
});

describe("GST", () => {
  it("splits intra-state into equal CGST/SGST", () => {
    const g = computeGst(Money.fromRupees(10000), 500, true);
    expect(g.total.formatIndian()).toBe("500.00");
    expect(g.cgst.formatIndian()).toBe("250.00");
    expect(g.sgst.formatIndian()).toBe("250.00");
    expect(g.igst.isZero()).toBe(true);
    expect(g.cgst.add(g.sgst).eq(g.total)).toBe(true);
  });

  it("splits odd remainders deterministically to CGST", () => {
    const g = computeGst(Money.fromPaise(33n), 1800, true);
    expect(g.total.paise).toBe(6n); // 5.94 -> 6
    expect(g.cgst.paise + g.sgst.paise).toBe(g.total.paise);
    expect(g.cgst.paise).toBe(3n);
  });

  it("charges IGST for inter-state", () => {
    const g = computeGst(Money.fromRupees(10000), 1800, false);
    expect(g.igst.formatIndian()).toBe("1,800.00");
    expect(g.cgst.isZero() && g.sgst.isZero()).toBe(true);
  });
});

describe("TDS", () => {
  it("computes TDS half-up", () => {
    expect(computeTds(Money.fromRupees(50000), 200).formatIndian()).toBe("1,000.00"); // 194C @2%
    expect(computeTds(Money.fromRupees("9999.99"), 100).paise).toBe(10000n); // 99.9999 -> 100.00
  });

  it("works through a RateTable", () => {
    const tds194C = new RateTable().add({ rateBps: 200, effectiveFrom: "2025-04-01" });
    expect(tds194C.taxFor(Money.fromRupees(250000), "2025-08-29").formatIndian()).toBe("5,000.00");
  });
});
