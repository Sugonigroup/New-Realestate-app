/** Statutory calendar (WP-4C): due-date rules, period generation, overdue scan. */

export type StatutoryKind = "gst" | "tds" | "pf" | "esic" | "pt" | "rera_qpr" | "roc" | "licence_renewal";

export interface StatutoryRule {
  kind: StatutoryKind;
  label: string;
  /** day-of-month after period end (11th for GST, 7th TDS, 15th PF, …) */
  dueDayOfMonth: number;
  ownerRole: string;
  escalationRole: string;
}

export const STATUTORY_RULES: StatutoryRule[] = [
  { kind: "gst", label: "GSTR-1 & 3B", dueDayOfMonth: 11, ownerRole: "finance_manager", escalationRole: "cfo" },
  { kind: "tds", label: "TDS payment & return", dueDayOfMonth: 7, ownerRole: "finance_manager", escalationRole: "cfo" },
  { kind: "pf", label: "PF remittance", dueDayOfMonth: 15, ownerRole: "hr_manager", escalationRole: "cfo" },
  { kind: "esic", label: "ESIC remittance", dueDayOfMonth: 15, ownerRole: "hr_manager", escalationRole: "cfo" },
  { kind: "pt", label: "Professional tax", dueDayOfMonth: 20, ownerRole: "hr_manager", escalationRole: "cfo" },
];

export interface StatutoryItem {
  kind: StatutoryKind;
  label: string;
  period: string; // e.g. "2026-08"
  dueOn: Date;
  ownerRole: string;
  escalationRole: string;
}

/** Due date = `dueDayOfMonth` of the month following the period. */
function monthEndPlus(year: number, month0: number, dueDay: number): Date {
  return new Date(Date.UTC(year, month0 + 1, dueDay));
}

export function generateMonthlyItems(year: number, month0: number, rules: StatutoryRule[] = STATUTORY_RULES): StatutoryItem[] {
  const period = `${year}-${String(month0 + 1).padStart(2, "0")}`;
  return rules.map((r) => ({
    kind: r.kind,
    label: r.label,
    period,
    dueOn: monthEndPlus(year, month0, r.dueDayOfMonth),
    ownerRole: r.ownerRole,
    escalationRole: r.escalationRole,
  }));
}

export interface OverdueEntry {
  kind: StatutoryKind;
  period: string;
  dueOn: Date;
  daysOverdue: number;
  escalateTo: string;
}

/** Overdue scan: unpaid items past due escalate to the next role (07 §7). */
export function scanOverdue(
  items: Array<StatutoryItem & { status: "open" | "filed" }>,
  now: Date,
): OverdueEntry[] {
  return items
    .filter((i) => i.status === "open" && i.dueOn.getTime() < now.getTime())
    .map((i) => ({
      kind: i.kind,
      period: i.period,
      dueOn: i.dueOn,
      daysOverdue: Math.floor((now.getTime() - i.dueOn.getTime()) / 86_400_000),
      escalateTo: i.escalationRole,
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}

// ── DPDP DSAR workflow (WP-4E, 12 §10) ─────────────────────────────────────

export type DsarType = "access" | "correction" | "erasure";
export type DsarState = "received" | "in_progress" | "completed" | "partially_completed" | "rejected";

const DSAR_TRANSITIONS: Record<DsarState, DsarState[]> = {
  received: ["in_progress", "rejected"],
  in_progress: ["completed", "partially_completed", "rejected"],
  completed: [],
  partially_completed: [],
  rejected: [],
};

export function dsarTransition(from: DsarState, to: DsarState): void {
  if (!DSAR_TRANSITIONS[from].includes(to)) {
    throw new RangeError(`illegal DSAR transition: ${from} → ${to}`);
  }
}

/** Erasure honors statutory carve-outs (7y audit/finance, RERA records). */
export function erasureCarveouts(dataCategories: string[]): { erasable: string[]; retained: string[] } {
  const CARVE_OUTS = ["audit", "finance", "rera", "statutory", "tax"];
  const [erasable, retained] = dataCategories.reduce(
    ([e, r], c) => {
      (CARVE_OUTS.some((k) => c.includes(k)) ? r : e).push(c);
      return [e, r];
    },
    [[], []] as [string[], string[]],
  );
  return { erasable, retained };
}
