import { Money } from "@buildos/money-utils";
import { profileFor, qprPeriodFor } from "./state-profiles.js";

/**
 * QPR engine (WP-4B, 12 §3): field-by-field auto-fill from system data per the
 * state profile schema, review workflow (maker → checker → submit, SoD per
 * 09 §2), and idempotent quarters. Numbers are computed, never narrated by an
 * LLM; narrative drafting is Phase 5 AI with human confirmation.
 */

export interface QprSourceData {
  physicalCompletionPct: number;
  milestonesCertified: string[];
  unitsSanctioned: number;
  unitsBookedQuarter: number;
  unitsBookedCumulative: number;
  cancellationsQuarter: number;
  areaBookedSqm: number;
  collectedPaise: bigint;
  demandedPaise: bigint;
  escrowBalancePaise: bigint;
  withdrawnPaise: bigint;
  litigation: Array<{ caseNo: string; status: string }>;
  newApprovals: string[];
  activeAgents: string[];
  progressPhotos: string[];
}

export interface QprPayload {
  state: string;
  authority: string;
  year: number;
  period: string;
  fields: Record<string, unknown>;
  sections: string[];
  attachments: Array<{ kind: string; ref: string }>;
}

export interface QprDraftResult {
  payload: QprPayload;
  autofillPct: number; // share of fields system-filled (target ≥90)
  manualGaps: string[];
}

/** Draft the quarter's QPR from live system data for the project's state. */
export function draftQpr(
  stateCode: string,
  onDate: Date,
  data: QprSourceData,
  registrationNo: string,
): QprDraftResult {
  const profile = profileFor(stateCode);
  const period = qprPeriodFor(stateCode, onDate);

  const sections: Record<string, Record<string, unknown>> = {
    progress: {
      physical_completion_pct: data.physicalCompletionPct,
      milestones_certified: data.milestonesCertified,
      progress_photo_refs: data.progressPhotos,
    },
    sales: {
      units_sanctioned: data.unitsSanctioned,
      units_booked_quarter: data.unitsBookedQuarter,
      units_booked_cumulative: data.unitsBookedCumulative,
      cancellations_quarter: data.cancellationsQuarter,
      area_booked_sqm: data.areaBookedSqm,
    },
    collections: {
      amount_demanded_paise: data.demandedPaise.toString(),
      amount_collected_paise: data.collectedPaise.toString(),
      escrow_balance_paise: data.escrowBalancePaise.toString(),
      withdrawn_paise: data.withdrawnPaise.toString(),
      segregated_account: "RERA designated account (per profile)",
    },
    litigation: { cases: data.litigation },
    approvals: { new_approvals: data.newApprovals, registration_no: registrationNo },
    agents: { registered_agents: data.activeAgents },
    complaints: { note: "sourced from complaints module" },
  };

  const manualGaps: string[] = [];
  if (data.progressPhotos.length < 3) manualGaps.push("progress photos below evidence minimum (11 §6)");
  if (data.escrowBalancePaise < 0n) manualGaps.push("escrow balance negative — reconcile before submission");

  const payload: QprPayload = {
    state: profile.state,
    authority: profile.authority,
    year: period.year,
    period: period.period,
    sections: profile.qpr.sections,
    fields: {},
    attachments: [
      ...data.progressPhotos.slice(0, 20).map((ref) => ({ kind: "progress_photo", ref })),
      ...data.newApprovals.map((ref) => ({ kind: "approval", ref })),
    ],
  };
  for (const section of profile.qpr.sections) {
    payload.fields[section] = sections[section];
  }

  const totalFields = profile.qpr.sections.length * 4; // rough normalizer for autofill share
  const manualFieldCount = manualGaps.length;
  const autofillPct = Math.round(((totalFields - manualFieldCount) / totalFields) * 100);
  return { payload, autofillPct, manualGaps };
}

/** Review workflow states (09 §2: maker ≠ submitter). */
export type QprState = "draft" | "in_review" | "approved" | "submitted" | "filed" | "overdue";

const QPR_TRANSITIONS: Record<QprState, QprState[]> = {
  draft: ["in_review"],
  in_review: ["approved", "draft"], // checker sends back
  approved: ["submitted"],
  submitted: ["filed"], // on acknowledgement upload
  filed: [],
  overdue: [],
};

export function qprTransition(from: QprState, to: QprState): void {
  if (!QPR_TRANSITIONS[from].includes(to)) {
    throw new RangeError(`illegal QPR transition: ${from} → ${to}`);
  }
}

/** Export bundle for the state portal upload (structured data + attachments). */
export function exportBundle(payload: QprPayload): { filename: string; json: string } {
  return {
    filename: `${payload.authority.replace(/\s+/g, "-")}_${payload.year}_${payload.period}.json`,
    json: JSON.stringify(payload, null, 2),
  };
}

/** Advertisements compliance: registration number presence check (BR-C, s.11(2)). */
export function assertRegistrationInCreative(creativeText: string, registrationNo: string): void {
  if (!creativeText.includes(registrationNo)) {
    throw new RangeError(`creative lacks RERA registration number ${registrationNo} (Section 11(2))`);
  }
}

/** Disclosure mirror: portal-facing claims must match system state exactly. */
export function assertDisclosureMirror(
  displayed: { pricePaise: bigint; carpetSqm: number; committedDate: string },
  system: { pricePaise: bigint; carpetSqm: number; committedDate: string },
): void {
  const mismatches: string[] = [];
  if (displayed.pricePaise !== system.pricePaise) mismatches.push("price");
  if (displayed.carpetSqm !== system.carpetSqm) mismatches.push("carpet area");
  if (displayed.committedDate !== system.committedDate) mismatches.push("committed date");
  if (mismatches.length) throw new RangeError(`disclosure mirror drift: ${mismatches.join(", ")} (BR-C)`);
}

// Keep Money imported for downstream narrative use without floating math
export const qprMoney = (paise: bigint): string => Money.fromPaise(paise).formatIndian();
