/**
 * RERA state profiles (WP-4A/4B, 12 §2): per-state statutory differences as
 * versioned config. UNKNOWN legal details are represented as explicit fields
 * the compliance consultant validates per tenant — never guessed at runtime.
 */

export type QprCadence = "quarterly" | "half_yearly";

export interface StateProfile {
  state: string;
  authority: string;
  qpr: { cadence: QprCadence; sections: string[] };
  aftRegistrationRequired: boolean;
  agentRegistrationRequired: boolean;
  /** annual interest schedule reference (effective rates in finance config) */
  interestScheduleRef: string;
  complaintFeeRupees: number;
}

export const STATE_PROFILES: Record<string, StateProfile> = {
  "MH": {
    state: "Maharashtra",
    authority: "MahaRERA",
    qpr: { cadence: "quarterly", sections: ["progress", "sales", "collections", "litigation", "approvals", "agents"] },
    aftRegistrationRequired: true,
    agentRegistrationRequired: true,
    interestScheduleRef: "mahaSchedule2024",
    complaintFeeRupees: 5000,
  },
  "KA": {
    state: "Karnataka",
    authority: "K-RERA",
    qpr: { cadence: "quarterly", sections: ["progress", "sales", "collections", "litigation"] },
    aftRegistrationRequired: true,
    agentRegistrationRequired: true,
    interestScheduleRef: "keralaScheduleRefKA",
    complaintFeeRupees: 1000,
  },
  "TN": {
    state: "Tamil Nadu",
    authority: "TN-RERA",
    qpr: { cadence: "half_yearly", sections: ["progress", "sales", "collections", "litigation"] },
    aftRegistrationRequired: true,
    agentRegistrationRequired: true,
    interestScheduleRef: "tnSchedule2024",
    complaintFeeRupees: 1000,
  },
  "TG": {
    state: "Telangana",
    authority: "RERA Telangana",
    qpr: { cadence: "quarterly", sections: ["progress", "sales", "collections", "litigation"] },
    aftRegistrationRequired: true,
    agentRegistrationRequired: true,
    interestScheduleRef: "tsSchedule2024",
    complaintFeeRupees: 1000,
  },
  "UP": {
    state: "Uttar Pradesh",
    authority: "UP-RERA",
    qpr: { cadence: "quarterly", sections: ["progress", "sales", "collections", "litigation", "complaints"] },
    aftRegistrationRequired: true,
    agentRegistrationRequired: true,
    interestScheduleRef: "upSchedule2024",
    complaintFeeRupees: 2000,
  },
};

export function profileFor(stateCode: string): StateProfile {
  const p = STATE_PROFILES[stateCode];
  if (!p) {
    throw new RangeError(
      `no RERA state profile for "${stateCode}" — create one with the compliance consultant before project go-live (12 §2)`,
    );
  }
  return p;
}

/** QPR period key from a date per the profile cadence. */
export function qprPeriodFor(stateCode: string, onDate: Date): { year: number; period: string; opensOn: Date; dueOn: Date } {
  const profile = profileFor(stateCode);
  const year = onDate.getUTCFullYear();
  if (profile.qpr.cadence === "quarterly") {
    const quarter = Math.floor(onDate.getUTCMonth() / 3); // 0..3
    const period = `Q${quarter + 1}`;
    const periodEnd = new Date(Date.UTC(year, quarter * 3 + 3, 0));
    return { year, period, opensOn: periodEnd, dueOn: new Date(periodEnd.getTime() + 30 * 86_400_000) };
  }
  const half = onDate.getUTCMonth() < 6 ? "H1" : "H2";
  const periodEnd = new Date(Date.UTC(year, half === "H1" ? 6 : 12, 0));
  return { year, period: half, opensOn: periodEnd, dueOn: new Date(periodEnd.getTime() + 30 * 86_400_000) };
}
