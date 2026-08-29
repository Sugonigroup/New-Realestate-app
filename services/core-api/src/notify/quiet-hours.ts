/** Quiet hours in IST (05 §1: 21:00–08:00); S0 severity bypasses (20 §1). */

const IST_OFFSET_MIN = 330; // UTC+5:30

export interface QuietWindow {
  startHour: number; // 21
  endHour: number; // 8
}

export const DEFAULT_QUIET: QuietWindow = { startHour: 21, endHour: 8 };

/** IST hour-of-day for a UTC instant. */
export function istHour(nowUtc: Date): number {
  const shifted = new Date(nowUtc.getTime() + IST_OFFSET_MIN * 60_000);
  return shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
}

export function isQuietHours(nowUtc: Date, win: QuietWindow = DEFAULT_QUIET): boolean {
  const h = istHour(nowUtc);
  return win.startHour > win.endHour ? h >= win.startHour || h < win.endHour : h >= win.startHour && h < win.endHour;
}

export type Severity = "S0" | "S1" | "S2" | "S3";

/** S0 (safety incidents, escrow breach, payment failures) always goes out. */
export function shouldDefer(nowUtc: Date, severity: Severity, win: QuietWindow = DEFAULT_QUIET): boolean {
  if (severity === "S0") return false;
  return isQuietHours(nowUtc, win);
}
