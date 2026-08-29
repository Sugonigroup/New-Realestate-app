import { describe, expect, it } from "vitest";
import { Money } from "@buildos/money-utils";
import { allocateFifo } from "./allocation.js";
import { computeInterest } from "./interest.js";
import { evaluateDunning } from "./dunning.js";
import { validateInstrument } from "./instruments.js";
import { reconcile } from "./recon.js";

describe("FIFO allocation (FR-7.3)", () => {
  const demands = [
    { id: "d1", amountPaise: 100_000_00n, paidPaise: 0n, dueDate: new Date("2026-01-01") },
    { id: "d2", amountPaise: 100_000_00n, paidPaise: 20_000_00n, dueDate: new Date("2026-02-01") },
    { id: "d3", amountPaise: 100_000_00n, paidPaise: 0n, dueDate: null }, // certification-linked → last
  ];

  it("allocates oldest first and marks fully-settled demands", () => {
    const r = allocateFifo(demands, Money.fromPaise(150_000_00n));
    expect(r.allocations).toEqual([
      { demandId: "d1", amountPaise: 100_000_00n, fullySettled: true },
      { demandId: "d2", amountPaise: 50_000_00n, fullySettled: false },
    ]);
    expect(r.unallocated.isZero()).toBe(true);
  });

  it("surplus becomes unallocated advance", () => {
    const r = allocateFifo(demands.slice(0, 1), Money.fromPaise(120_000_00n));
    expect(r.allocations[0]!.amountPaise).toBe(100_000_00n);
    expect(r.unallocated.formatIndian()).toBe("20,000.00");
  });

  it("overpaid demands are skipped", () => {
    const r = allocateFifo([{ id: "x", amountPaise: 100n, paidPaise: 200n, dueDate: null }], Money.fromPaise(50n));
    expect(r.allocations).toHaveLength(0);
    expect(r.unallocated.paise).toBe(50n);
  });
});

describe("interest engine (FR-7.1, golden paise)", () => {
  const base = { id: "d-test", amountPaise: 50_000_000n, paidPaise: 0n, dueDate: null };

  it("10.25% p.a. on ₹5L for 30 days = ₹4,212.33", () => {
    const due = new Date("2026-01-01");
    const r = computeInterest({ demand: { ...base, dueDate: due }, rateBps: 1025, asOf: new Date(due.getTime() + 30 * 86_400_000) });
    expect(r.daysLate).toBe(30);
    // 50,000,000 × 1025 × 30 / 3,650,000 = 4,212,328.76… → 421233
    expect(r.interest.paise).toBe(421233n);
  });

  it("cap is enforced (rate > RERA cap → cap applies)", () => {
    const due = new Date("2026-01-01");
    const r = computeInterest({ demand: { ...base, dueDate: due }, rateBps: 2000, capBps: 1200, asOf: new Date(due.getTime() + 365 * 86_400_000) });
    expect(r.rateAppliedBps).toBe(1200);
    expect(r.interest.paise).toBe(6000000n); // 12% of ₹5L for a year
  });

  it("not late → zero; fully paid → zero", () => {
    const due = new Date("2026-01-01");
    expect(computeInterest({ demand: { ...base, dueDate: due }, rateBps: 1025, asOf: due }).interest.isZero()).toBe(true);
    expect(computeInterest({ demand: { ...base, paidPaise: 50_000_000n, dueDate: due }, rateBps: 1025, asOf: new Date("2026-06-01") }).interest.isZero()).toBe(true);
  });
});

describe("dunning T-7/T-3/T-0/T+7 (idempotent)", () => {
  const due = new Date("2026-06-10");
  const at = (daysFromDue: number) => new Date(due.getTime() + daysFromDue * 86_400_000);

  it("escalates through steps exactly once each", () => {
    expect(evaluateDunning({ dueDate: due, lastDunningStep: null }, at(-8)).dueSteps).toEqual([]);
    expect(evaluateDunning({ dueDate: due, lastDunningStep: null }, at(-6)).dueSteps).toEqual(["T-7"]);
    expect(evaluateDunning({ dueDate: due, lastDunningStep: "T-7" }, at(-2)).dueSteps).toEqual(["T-3"]);
    expect(evaluateDunning({ dueDate: due, lastDunningStep: "T-3" }, at(0)).dueSteps).toEqual(["T-0"]);
    expect(evaluateDunning({ dueDate: due, lastDunningStep: "T-0" }, at(9)).dueSteps).toEqual(["T+7"]);
    expect(evaluateDunning({ dueDate: due, lastDunningStep: "T+7" }, at(30)).dueSteps).toEqual([]);
  });

  it("construction-linked demands (no due date) never dunning-run", () => {
    expect(evaluateDunning({ dueDate: null, lastDunningStep: null }, new Date("2027-01-01")).dueSteps).toEqual([]);
  });
});

describe("instrument validation (BR-K)", () => {
  const twoLakh = Money.fromPaise(200_000_00n);
  it("blocks cash above ₹2,00,000 (Section 269ST)", () => {
    expect(validateInstrument("cash", Money.fromPaise(200_000_01n)).ok).toBe(false);
    expect(validateInstrument("cash", twoLakh).ok).toBe(true);
    expect(validateInstrument("cash", twoLakh).ok).toBe(true);
  });
  it("NEFT/RTGS/cheque/NACH need references", () => {
    expect(validateInstrument("neft", twoLakh).ok).toBe(false);
    expect(validateInstrument("neft", twoLakh, "UTR123").ok).toBe(true);
    expect(validateInstrument("gateway", twoLakh).ok).toBe(true); // gateway ref = its own id
  });
});

describe("bank reconciliation matcher", () => {
  it("auto-matches on exact amount + narration ref; rest to exceptions", () => {
    const lines = [
      { utr: "UTR-A", amountPaise: 100_000_00n, narration: "NEFT RAVI KUMAR BK-0001", date: new Date() },
      { utr: "UTR-B", amountPaise: 50_000_00n, narration: "random credit", date: new Date() },
    ];
    const expectations = [
      { bookingId: "bk-1", expectPaise: 100_000_00n, expectRef: "BK-0001" },
      { bookingId: "bk-2", expectPaise: 70_000_00n },
    ];
    const r = reconcile(lines, expectations);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0]!.expectation.bookingId).toBe("bk-1");
    expect(r.unmatchedLines.map((l) => l.utr)).toEqual(["UTR-B"]);
    expect(r.unmatchedExpectations.map((e) => e.bookingId)).toEqual(["bk-2"]);
  });
});
