import { describe, expect, it } from "vitest";
import { Money } from "@buildos/money-utils";
import {
  generateSchedule,
  standardClpMilestones,
  standardDplpMilestones,
  standardPlpMilestones,
  standardTemplates,
  type PlanMilestone,
} from "./schedule.js";

const BOOKING = new Date("2026-09-01T04:00:00Z");

const SETS: Array<{ planType: "CLP" | "DPLP" | "PLP"; milestones: PlanMilestone[] }> = [
  { planType: "CLP", milestones: standardClpMilestones() },
  { planType: "DPLP", milestones: standardDplpMilestones() },
  { planType: "PLP", milestones: standardPlpMilestones() },
];

// 21-scenario matrix: 3 plans × 7 totals (incl. odd-paise consideration values)
const TOTALS = [
  "45123456.67", "12945718.75", "20000000.00", "7891234.57", "123456789.99",
  "5000000.01", "99999999.99",
].map((r) => Money.fromRupees(r));

describe("payment-plan schedule generator (WP-1C golden matrix)", () => {
  for (const { planType, milestones } of SETS) {
    for (const total of TOTALS) {
      it(`${planType} @ ${total.formatIndian()} sums exactly to the total`, () => {
        const schedule = generateSchedule({ planType, milestones, total, bookingDate: BOOKING });
        expect(Money.sum(schedule.map((s) => s.amount)).eq(total)).toBe(true);
        expect(schedule.every((s) => s.amount.paise >= 0n)).toBe(true);
      });
    }
  }

  it("CLP: day-offset milestones get dates; construction milestones stay open", () => {
    const schedule = generateSchedule({ planType: "CLP", milestones: standardClpMilestones(), total: Money.fromRupees(10000000), bookingDate: BOOKING });
    expect(schedule).toHaveLength(10);
    expect(schedule[0]).toMatchObject({ key: "booking", dueDate: BOOKING });
    expect(schedule[1]!.dueDate).toEqual(new Date(BOOKING.getTime() + 15 * 86_400_000));
    for (const item of schedule.slice(2)) {
      expect(item.dueDate).toBeNull(); // construction-linked → due on certification
      expect(item.trigger.kind).toBe("construction_milestone");
    }
  });

  it("DPLP 20/70/10 lands the big slug on AFT day 30", () => {
    const schedule = generateSchedule({ planType: "DPLP", milestones: standardDplpMilestones(), total: Money.fromRupees(10000000), bookingDate: BOOKING });
    expect(schedule[1]!.amount.formatIndian()).toBe("70,00,000.00");
    expect(schedule[1]!.dueDate).toEqual(new Date(BOOKING.getTime() + 30 * 86_400_000));
  });

  it("percentages must sum to exactly 100", () => {
    const bad: PlanMilestone[] = [...standardPlpMilestones()];
    bad[0] = { ...bad[0]!, percent: 15 };
    expect(() => generateSchedule({ planType: "PLP", milestones: bad, total: Money.fromRupees(100), bookingDate: BOOKING })).toThrow(
      /must be exactly 100/,
    );
  });

  it("seeded templates cover CLP/DPLP/PLP", () => {
    expect(standardTemplates().map((t) => t.planType)).toEqual(["CLP", "DPLP", "PLP"]);
  });
});
