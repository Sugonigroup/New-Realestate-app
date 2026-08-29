import { describe, expect, it } from "vitest";
import { Money } from "@buildos/money-utils";
import { computeUnitPrice, type PriceListShape } from "./pricing.js";

const PRICE_LIST: PriceListShape = {
  baseRatePaise: 8_200_000n, // ₹82,000 / sqm
  floorRisePaise: 150_000n, // ₹1,500 / sqm / floor
  viewPremiumPaise: 100_000n, // ₹1,000 / sqm (park-facing)
  plcPaise: 5_000_000n, // ₹50,000
  edcPaise: 7_500_000n, // ₹75,000
  idcPaise: 5_000_000n, // ₹50,000
  clubPaise: 10_000_000n, // ₹1,00,000
  corpusPaise: 6_000_000n, // ₹60,000
  gstRateBps: 500, // 5% non-ITC (BR-F)
};

describe("unit pricing golden test (exact paise)", () => {
  // SBA 138.75 sqm, 3rd floor, park view:
  //   base       82,000 × 138.75            = ₹1,13,77,500.00
  //   floor rise 1,500 × 138.75 × 3          = ₹   6,24,375.00
  //   view       1,000 × 138.75              = ₹   1,38,750.00
  //   plc/edc/idc                            = ₹  1,75,000.00
  //   taxable                                = ₹1,23,15,625.00
  //   GST 5%                                 = ₹   6,15,781.25
  //   club + corpus                          = ₹  1,60,000.00
  //   total                                  = ₹1,30,91,406.25
  const unit = { sbaSqm: "138.75", floor: 3, hasView: true };

  it("computes every line to the exact paise", () => {
    const p = computeUnitPrice(PRICE_LIST, unit);
    expect(p.base.formatIndian()).toBe("1,13,77,500.00");
    expect(p.floorRise.formatIndian()).toBe("6,24,375.00");
    expect(p.view.formatIndian()).toBe("1,38,750.00");
    expect(p.plc.add(p.edc).add(p.idc).formatIndian()).toBe("1,75,000.00");
    expect(p.gst.formatIndian()).toBe("6,15,781.25");
    expect(p.total.formatIndian()).toBe("1,30,91,406.25");
  });

  it("lines (excl. zero lines) plus GST reconcile to the total", () => {
    const p = computeUnitPrice(PRICE_LIST, unit);
    const lineSum = Money.sum(p.lines.filter((l) => l.key !== "gst").map((l) => l.amount));
    expect(lineSum.add(p.gst).eq(p.total)).toBe(true);
  });

  it("ground floor has no floor rise; zero-rate GST is exact", () => {
    const ground = computeUnitPrice(PRICE_LIST, { sbaSqm: "138.75", floor: 0, hasView: false });
    expect(ground.floorRise.isZero()).toBe(true);
    expect(ground.view.isZero()).toBe(true);
    expect(ground.lines.some((l) => l.key === "floor_rise")).toBe(false);

    const exempt = computeUnitPrice({ ...PRICE_LIST, gstRateBps: 0 }, unit);
    expect(exempt.gst.isZero()).toBe(true);
  });

  it("rejects invalid areas and floors", () => {
    expect(() => computeUnitPrice(PRICE_LIST, { sbaSqm: "0", floor: 0 })).toThrow(TypeError);
    expect(() => computeUnitPrice(PRICE_LIST, { sbaSqm: "-10", floor: 0 })).toThrow(TypeError);
    expect(() => computeUnitPrice(PRICE_LIST, { sbaSqm: "100", floor: -1 })).toThrow(TypeError);
  });
});
