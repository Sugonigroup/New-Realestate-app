/** Approvals register (WP-3A, 11 §1) + NCR/snag/incident workflows (WP-3C). */

// ── Approvals register: expiry scanning ─────────────────────────────────────

export interface ApprovalDoc {
  id: string;
  kind: string; // sanctioned_plan | fire_noc | environmental | cc | oc | lift_licence | …
  ref: string;
  expiresAt?: Date | null;
}

export interface ExpiryReport {
  expired: ApprovalDoc[];
  expiringSoon: ApprovalDoc[]; // within `withinDays`, sorted nearest first
}

export function scanExpiries(docs: ApprovalDoc[], now: Date, withinDays = 60): ExpiryReport {
  const active = docs.filter((d) => d.expiresAt !== null && d.expiresAt !== undefined);
  const expired = active.filter((d) => d.expiresAt!.getTime() < now.getTime());
  const horizon = now.getTime() + withinDays * 86_400_000;
  const expiringSoon = active
    .filter((d) => d.expiresAt!.getTime() >= now.getTime() && d.expiresAt!.getTime() <= horizon)
    .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime());
  return { expired, expiringSoon };
}

/** RERA impact of a plan revision (BR: Section 14 — changes need consent/approval). */
export function assessPlanChange(input: {
  committedCompletionDate: Date;
  revisedCompletionDate: Date;
  buyerConsentTaken?: boolean;
  authorityApprovalRef?: string | null;
}): { reraImpact: "none" | "authority_extension_required" | "buyer_consent_required"; notes: string[] } {
  const notes: string[] = [];
  const slips = input.revisedCompletionDate.getTime() > input.committedCompletionDate.getTime();
  if (!slips) {
    return { reraImpact: "none", notes: ["revision does not affect committed dates"] };
  }
  notes.push("committed completion date slips — RERA timeline revision required");
  if (!input.authorityApprovalRef) {
    return { reraImpact: "authority_extension_required", notes };
  }
  notes.push(`authority extension on record: ${input.authorityApprovalRef}`);
  if (!input.buyerConsentTaken) {
    return { reraImpact: "buyer_consent_required", notes };
  }
  notes.push("buyer consent on record");
  return { reraImpact: "none", notes };
}

// ── NCR workflow (11 §7) ────────────────────────────────────────────────────

export type NcrState = "open" | "contained" | "rca" | "corrective_action" | "reinspection" | "closed" | "rejected";

const NCR_TRANSITIONS: Record<NcrState, NcrState[]> = {
  open: ["contained"],
  contained: ["rca"],
  rca: ["corrective_action"],
  corrective_action: ["reinspection"],
  reinspection: ["closed", "corrective_action"], // fail → back to corrective
  closed: [],
  rejected: [],
};

export function ncrTransition(from: NcrState, to: NcrState): void {
  if (!NCR_TRANSITIONS[from].includes(to)) {
    throw new RangeError(`illegal NCR transition: ${from} → ${to}`);
  }
}

/** CAPA aging SLA by severity (days to close) — feeds compliance KPIs. */
export const NCR_SLA_DAYS: Record<string, number> = { minor: 14, major: 7, critical: 2 };

// ── Snags (customer handover defects) ───────────────────────────────────────

export type SnagState = "raised" | "assigned" | "fixed" | "verified" | "closed" | "wont_fix";

const SNAG_TRANSITIONS: Record<SnagState, SnagState[]> = {
  raised: ["assigned", "wont_fix"],
  assigned: ["fixed"],
  fixed: ["verified"],
  verified: ["closed", "raised"], // failed verification re-raises
  closed: [],
  wont_fix: [],
};

export function snagTransition(from: SnagState, to: SnagState): void {
  if (!SNAG_TRANSITIONS[from].includes(to)) {
    throw new RangeError(`illegal snag transition: ${from} → ${to}`);
  }
}

// ── Safety incidents (11 §8) ────────────────────────────────────────────────

export type IncidentSeverity = "near_miss" | "minor" | "major" | "fatal";

export interface IncidentClassification {
  reportableToAuthority: boolean;
  capaSlaDays: number;
  workStoppage: boolean;
}

export function classifyIncident(severity: IncidentSeverity): IncidentClassification {
  switch (severity) {
    case "fatal":
      return { reportableToAuthority: true, capaSlaDays: 1, workStoppage: true };
    case "major":
      return { reportableToAuthority: true, capaSlaDays: 3, workStoppage: true };
    case "minor":
      return { reportableToAuthority: false, capaSlaDays: 7, workStoppage: false };
    case "near_miss":
      return { reportableToAuthority: false, capaSlaDays: 14, workStoppage: false };
    default: {
      const _exhaustive: never = severity;
      return _exhaustive;
    }
  }
}

// ── Drawing revision control (WP-3A) ────────────────────────────────────────

export interface DrawingRevision {
  rev: string;
  status: "current" | "superseded";
}

/** Only the current revision can be superseded; superseded revisions block RA bills. */
export function supersedeDrawing(revisions: DrawingRevision[], rev: string, newRev: string): DrawingRevision[] {
  const target = revisions.find((r) => r.rev === rev);
  if (!target) throw new RangeError(`revision ${rev} not found`);
  if (target.status !== "current") throw new RangeError(`revision ${rev} is already superseded`);
  return [...revisions.map((r) => (r.rev === rev ? { ...r, status: "superseded" as const } : r)), { rev: newRev, status: "current" }];
}

export function assertDrawingCurrent(revisions: DrawingRevision[], rev: string): void {
  const r = revisions.find((x) => x.rev === rev);
  if (!r || r.status !== "current") {
    throw new RangeError(`drawing revision ${rev ?? "?"} is superseded — RA bill reference not allowed (11 §1)`);
  }
}
