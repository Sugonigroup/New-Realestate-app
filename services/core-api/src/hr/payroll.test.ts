import { describe, expect, it } from "vitest";
import { computePayroll } from "./payroll.js";
import { clraGate, computeIncentives } from "./incentives.js";
import { aggregateMuster, evaluateAttendance } from "./attendance.js";

describe("payroll engine (WP-4G, golden paise)", () => {
  const structure = { basicMonthly: 3_000_000n, hraMonthly: 1_500_000n, specialMonthly: 1_500_000n }; // gross ₹60,000

  it("full month, Karnataka: PF capped at ₹15,000 wage, PT ₹200, TDS nil under 5L", () => {
    const r = computePayroll({ structure, daysInMonth: 31, paidDays: 31, stateCode: "KA" });
    expect(r.earnedBasicPaise).toBe(3_000_000n);
    expect(r.pfEmployeePaise).toBe(180_000n); // 12% of ₹15,000 cap
    expect(r.pfEmployerPaise).toBe(180_000n);
    expect(r.esicEmployeePaise).toBe(0n); // gross > ₹21,000
    expect(r.ptPaise).toBe(20_000n);
    // annual 7.2L − 50k std − 21.6k PF − 1.5L 80C = 4,98,400 → below 5L slab → nil
    expect(r.tdsPaise).toBe(0n);
    expect(r.netPaise).toBe(6_000_000n - 180_000n - 20_000n);
  });

  it("LOP prorates all earned components exactly", () => {
    const r = computePayroll({ structure, daysInMonth: 30, paidDays: 25, stateCode: "KA" });
    expect(r.earnedBasicPaise).toBe(2_500_000n); // 30,000 × 25/30
    expect(r.earnedGrossPaise).toBe(5_000_000n);
  });

  it("junior salary attracts ESIC both sides", () => {
    const junior = { basicMonthly: 1_200_000n, hraMonthly: 600_000n, specialMonthly: 200_000n }; // gross ₹20,000
    const r = computePayroll({ structure: junior, daysInMonth: 31, paidDays: 31, stateCode: "MH" });
    expect(r.esicEmployeePaise).toBe(15_000n); // 0.75% of ₹20,000
    expect(r.esicEmployerPaise).toBe(65_000n); // 3.25%
  });

  it("higher earner crosses TDS slabs with cess", () => {
    const senior = { basicMonthly: 10_000_000n, hraMonthly: 5_000_000n, specialMonthly: 5_000_000n }; // gross ₹2L/mo
    const r = computePayroll({ structure: senior, daysInMonth: 31, paidDays: 31, stateCode: "KA", annualDeductionsPaise: 0n });
    // annual 24L − 50k std − 21.6k PF → ₹23,28,400 taxable
    // tax: 12.5k@5% + 5L@20% + 13,28,400@30% = ₹5,11,020 + 4% cess = ₹5,31,461 → /12 ≈ ₹44,288
    expect(r.tdsPaise).toBeGreaterThan(400_000n); // > ₹4,000/mo
  });

  it("rejects impossible paid days", () => {
    expect(() => computePayroll({ structure, daysInMonth: 31, paidDays: 32, stateCode: "KA" })).toThrow(RangeError);
  });
});

describe("incentive engine (WP-4G, BR-H clawback)", () => {
  const scheme = { kind: "per_unit_flat" as const, flatPaise: 250_000n, clawbackWindowDays: 90 };

  it("pays per booking and claws back cancellations inside the window", () => {
    const out = computeIncentives(
      scheme,
      [
        { bookingId: "b1", bookedAt: new Date("2026-06-01"), cancelledAt: null, agreementValuePaise: 10_000_000_00n },
        { bookingId: "b2", bookedAt: new Date("2026-06-10"), cancelledAt: new Date("2026-07-01"), agreementValuePaise: 10_000_000_00n },
      ],
      new Date("2026-07-15"),
    );
    expect(out.payablePaise).toBe(250_000n);
    expect(out.perBooking.find((p) => p.bookingId === "b2")!.clawed).toBe(true);
  });

  it("pct_of_value scheme earns bps of agreement value", () => {
    const out = computeIncentives(
      { kind: "pct_of_value", rateBps: 25, clawbackWindowDays: 0 },
      [{ bookingId: "b1", bookedAt: new Date(), cancelledAt: null, agreementValuePaise: 10_000_000_00n }],
      new Date(),
    );
    expect(out.payablePaise).toBe(2_500_000n); // 0.25% of ₹1Cr = ₹25,000
  });

  it("count slabs escalate per unit within the scheme period", () => {
    const slabScheme = {
      kind: "slab_on_count" as const,
      clawbackWindowDays: 0,
      countSlabs: [
        { uptoUnits: 2, perUnitPaise: 200_000n },
        { uptoUnits: 4, perUnitPaise: 300_000n },
      ],
    };
    const events = [1, 2, 3, 4].map((i) => ({
      bookingId: `b${i}`, bookedAt: new Date(), cancelledAt: null, agreementValuePaise: 1n,
    }));
    const out = computeIncentives(slabScheme, events, new Date());
    expect(out.payablePaise).toBe(200_000n + 200_000n + 300_000n + 300_000n);
  });
});

describe("CLRA gate (BR-I)", () => {
  it("blocks expired or missing licences before payment", () => {
    expect(clraGate(null, new Date()).ok).toBe(false);
    expect(clraGate(new Date("2026-01-01"), new Date("2026-09-01")).ok).toBe(false);
    expect(clraGate(new Date("2027-01-01"), new Date("2026-09-01")).ok).toBe(true);
  });
});

describe("geo-attendance & muster (WP-4F/4H)", () => {
  const fence = { center: { lat: 12.9716, lng: 77.5946 }, radiusMeters: 150 };

  it("admits inside the fence, flags outside with distance", () => {
    const inside = evaluateAttendance(
      { userId: "u1", deviceId: "d1", at: { lat: 12.972, lng: 77.595 }, timestamp: new Date() },
      fence,
      [],
    );
    expect(inside.withinFence).toBe(true);
    const outside = evaluateAttendance(
      { userId: "u1", deviceId: "d1", at: { lat: 12.98, lng: 77.61 }, timestamp: new Date() },
      fence,
      [],
    );
    expect(outside.withinFence).toBe(false);
    expect(outside.anomalies.some((a) => a.includes("outside geofence"))).toBe(true);
  });

  it("flags buddy punching on device reuse within 10 minutes", () => {
    const t0 = new Date();
    const recent = [{ userId: "u1", deviceId: "d1", at: fence.center, timestamp: t0 }];
    const check = evaluateAttendance(
      { userId: "u2", deviceId: "d1", at: fence.center, timestamp: new Date(t0.getTime() + 5 * 60_000) },
      fence,
      recent,
    );
    expect(check.anomalies.some((a) => a.includes("buddy"))).toBe(true);
  });

  it("aggregates contractor mandays by contractor and trade", () => {
    const muster = aggregateMuster([
      { date: new Date(), contractorId: "c1", trade: "mason", headcount: 12 },
      { date: new Date(), contractorId: "c1", trade: "mason", headcount: 10 },
      { date: new Date(), contractorId: "c1", trade: "helper", headcount: 20 },
    ]);
    expect(muster.get("c1:mason")!.mandays).toBe(22);
    expect(muster.get("c1:helper")!.mandays).toBe(20);
  });
});
