import { describe, expect, it } from "vitest";
import { REPORT_SCHEDULES, isDue, istFields, periodLabel } from "./report-scheduler.js";

// 05:30 IST daily brief == 00:00 UTC
const DAILY_RUN = new Date("2026-09-30T00:00:00Z");
// 07:00 IST Monday == 01:30 UTC Monday
const MONDAY_RUN = new Date("2026-09-28T01:30:00Z"); // Mon
const TUESDAY_SAME_TIME = new Date("2026-09-29T01:30:00Z"); // Tue

describe("report scheduler (WP-5C, 13 §2)", () => {
  it("IST conversion is correct (UTC 00:00 → 05:30 IST)", () => {
    expect(istFields(DAILY_RUN)).toMatchObject({ hour: 5, day: 3, date: 30 });
  });

  it("daily brief is due at/after 05:30 IST, before that not yet", () => {
    expect(isDue(REPORT_SCHEDULES.ceo_daily, DAILY_RUN, null)).toBe(true);
    expect(isDue(REPORT_SCHEDULES.ceo_daily, new Date("2026-09-29T22:00:00Z"), null)).toBe(false); // 03:30 IST
  });

  it("same-day rerun after a successful run is suppressed", () => {
    expect(isDue(REPORT_SCHEDULES.ceo_daily, DAILY_RUN, DAILY_RUN)).toBe(false);
  });

  it("weekly review runs only on Mondays", () => {
    expect(isDue(REPORT_SCHEDULES.project_weekly, MONDAY_RUN, null)).toBe(true);
    expect(isDue(REPORT_SCHEDULES.project_weekly, TUESDAY_SAME_TIME, null)).toBe(false);
  });

  it("monthly review runs on the 1st", () => {
    const first = new Date("2026-10-01T01:30:00Z");
    expect(isDue(REPORT_SCHEDULES.management_monthly, first, null)).toBe(true);
    expect(isDue(REPORT_SCHEDULES.management_monthly, MONDAY_RUN, null)).toBe(false);
  });

  it("period labels are human-readable", () => {
    expect(periodLabel("ceo_daily", DAILY_RUN)).toContain("30 Sep 2026");
    expect(periodLabel("management_monthly", new Date("2026-10-01T01:30:00Z"))).toContain("Oct 2026");
  });
});
