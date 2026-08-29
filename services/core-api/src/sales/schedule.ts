import { Money } from "@buildos/money-utils";

/**
 * Payment-plan schedule generator (WP-1C, FR-3.3). Templates:
 *   CLP  — construction-linked (percent milestones, some tied to certified
 *          construction milestones, some day-offset from booking)
 *   DPLP — down-payment linked (large slug + possession)
 *   PLP  — possession-linked
 * The generator allocates percentages over the total consideration with the
 * largest-remainder method so the schedule sums EXACTLY to the total (golden-
 * tested to the paise across scenario matrices).
 */

export type MilestoneTrigger =
  | { kind: "on_booking" }
  | { kind: "days_from_booking"; days: number }
  | { kind: "construction_milestone"; milestoneKey: string }; // due on certification

export interface PlanMilestone {
  key: string;
  label: string;
  percent: number; // of total consideration; must sum to 100 across the plan
  trigger: MilestoneTrigger;
}

export interface PlanInput {
  planType: "CLP" | "DPLP" | "PLP";
  milestones: PlanMilestone[];
  total: Money; // agreement value incl. GST allocation as priced
  bookingDate: Date;
}

export interface ScheduleItem {
  seq: number;
  key: string;
  label: string;
  amount: Money;
  dueDate: Date | null; // null for construction-linked (due on certification)
  trigger: MilestoneTrigger;
}

export function standardClpMilestones(): PlanMilestone[] {
  return [
    { key: "booking", label: "On booking", percent: 10, trigger: { kind: "on_booking" } },
    { key: "agreement", label: "On AFT registration (15 days)", percent: 10, trigger: { kind: "days_from_booking", days: 15 } },
    { key: "plinth", label: "Plinth complete", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "plinth" } },
    { key: "slab_3", label: "3rd slab cast", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "slab_3" } },
    { key: "slab_6", label: "6th slab cast", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "slab_6" } },
    { key: "slab_top", label: "Top slab cast", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "slab_top" } },
    { key: "brickwork", label: "Brickwork complete", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "brickwork" } },
    { key: "plaster", label: "Internal plaster complete", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "plaster" } },
    { key: "finishes", label: "Finishes & MEP", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "finishes" } },
    { key: "possession", label: "On possession", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "possession" } },
  ];
}

export function standardDplpMilestones(): PlanMilestone[] {
  return [
    { key: "booking", label: "Down payment on booking", percent: 20, trigger: { kind: "on_booking" } },
    { key: "agreement", label: "Balance on AFT (30 days)", percent: 70, trigger: { kind: "days_from_booking", days: 30 } },
    { key: "possession", label: "On possession", percent: 10, trigger: { kind: "construction_milestone", milestoneKey: "possession" } },
  ];
}

export function standardPlpMilestones(): PlanMilestone[] {
  return [
    { key: "booking", label: "Booking amount", percent: 10, trigger: { kind: "on_booking" } },
    { key: "possession", label: "Balance on possession", percent: 90, trigger: { kind: "construction_milestone", milestoneKey: "possession" } },
  ];
}

function dueDateFor(trigger: MilestoneTrigger, bookingDate: Date): Date | null {
  switch (trigger.kind) {
    case "on_booking":
      return bookingDate;
    case "days_from_booking":
      return new Date(bookingDate.getTime() + trigger.days * 86_400_000);
    case "construction_milestone":
      return null; // demand generated when the milestone is certified (Phase 3 hook)
    default: {
      const _exhaustive: never = trigger;
      return _exhaustive;
    }
  }
}

export function generateSchedule(input: PlanInput): ScheduleItem[] {
  const percentSum = input.milestones.reduce((s, m) => s + m.percent, 0);
  if (percentSum !== 100) {
    throw new RangeError(`plan percentages sum to ${percentSum}, must be exactly 100`);
  }
  const amounts = input.total.allocate(input.milestones.map((m) => m.percent));
  return input.milestones.map((m, i) => ({
    seq: i + 1,
    key: m.key,
    label: m.label,
    amount: amounts[i]!,
    dueDate: dueDateFor(m.trigger, input.bookingDate),
    trigger: m.trigger,
  }));
}

/** Seeded templates (tenant-extensible). */
export function standardTemplates(): Array<{ planType: "CLP" | "DPLP" | "PLP"; code: string; name: string; milestones: PlanMilestone[] }> {
  return [
    { planType: "CLP", code: "CLP-STD", name: "Construction linked (standard)", milestones: standardClpMilestones() },
    { planType: "DPLP", code: "DPLP-STD", name: "Down payment linked (standard)", milestones: standardDplpMilestones() },
    { planType: "PLP", code: "PLP-STD", name: "Possession linked (standard)", milestones: standardPlpMilestones() },
  ];
}
