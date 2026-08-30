import { Money } from "@buildos/money-utils";


/** Report scheduler (WP-5C, 13 §2): IST cron definitions + next-run computation. */

export type ReportKey = "ceo_daily" | "project_weekly" | "management_monthly";

export interface ReportSchedule {
  key: ReportKey;
  title: string;
  /** IST hour + day-of-week/month rule */
  hourIst: number;
  dayOfWeek?: number; // 1=Mon
  dayOfMonth?: number; // 1st
}

export const REPORT_SCHEDULES: Record<ReportKey, ReportSchedule> = {
  ceo_daily: { key: "ceo_daily", title: "CEO Daily Brief", hourIst: 5, dayOfWeek: undefined, dayOfMonth: undefined },
  project_weekly: { key: "project_weekly", title: "Weekly Project Review", hourIst: 7, dayOfWeek: 1 },
  management_monthly: { key: "management_monthly", title: "Management Review", hourIst: 7, dayOfMonth: 1 },
};

/** Convert a UTC instant to IST field values. */
export function istFields(utc: Date): { year: number; month1: number; date: number; day: number; hour: number } {
  const ist = new Date(utc.getTime() + 330 * 60_000);
  return {
    year: ist.getUTCFullYear(),
    month1: ist.getUTCMonth() + 1,
    date: ist.getUTCDate(),
    day: ist.getUTCDay(),
    hour: ist.getUTCHours(),
  };
}

/** Is the report due to run at this instant? */
export function isDue(schedule: ReportSchedule, utc: Date, lastRunUtc: Date | null): boolean {
  const f = istFields(utc);
  if (f.hour < schedule.hourIst) return false;
  if (schedule.dayOfWeek !== undefined && f.day !== schedule.dayOfWeek) return false;
  if (schedule.dayOfMonth !== undefined && f.date !== schedule.dayOfMonth) return false;
  // don't rerun within the same IST day after a successful run
  if (lastRunUtc) {
    const last = istFields(lastRunUtc);
    if (last.date === f.date && last.month1 === f.month1) {
      if (f.hour >= schedule.hourIst) return false;
    }
  }
  return true;
}

/** Period label for the generated pack. */
export function periodLabel(key: ReportKey, utc: Date): string {
  const f = istFields(utc);
  if (key === "ceo_daily") return f.date + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][f.month1 - 1]! + " " + f.year;
  if (key === "project_weekly") return `week of ${f.date}/${f.month1}`;
  return `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][f.month1 - 1]!} ${f.year}`;
}

/** Money helper for report rows. */
export const packMoney = (paise: bigint): string => Money.fromPaise(paise).formatIndian();
