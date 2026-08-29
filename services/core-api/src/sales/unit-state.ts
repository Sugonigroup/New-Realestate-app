/** Unit state machine (FR-3.1 / phases/phase-1 WP-1C) — transitions are the law. */

export type UnitState = "available" | "held" | "blocked" | "booked" | "registered" | "cancelled";

const TRANSITIONS: Record<UnitState, UnitState[]> = {
  available: ["held", "blocked"], // blocked = legal/technical stop (dispute, retention)
  held: ["available", "blocked", "booked"], // booking converts a hold; SLA expiry releases
  blocked: ["available", "booked"], // block released or converted on approval
  booked: ["registered", "cancelled"], // registration on possession/transfer; cancellation path
  registered: [], // terminal: title transferred
  cancelled: ["available"], // released back to inventory (refund handled by finance)
};

export function canTransition(from: UnitState, to: UnitState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: UnitState, to: UnitState): void {
  if (!canTransition(from, to)) {
    throw new RangeError(`illegal unit transition: ${from} → ${to}`);
  }
}

/** Holds auto-expire (SLA from the hold, e.g. 24/48 h) — releasing back to available. */
export function isHoldExpired(heldAt: Date, holdHours: number, now: Date): boolean {
  return now.getTime() > heldAt.getTime() + holdHours * 3_600_000;
}
