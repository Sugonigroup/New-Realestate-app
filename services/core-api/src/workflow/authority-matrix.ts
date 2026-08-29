import { Money } from "@buildos/money-utils";

/**
 * Authority matrix as data (ADR-AI3 / `09-approval-system.md §2`).
 * Tenant-configurable; the seeded defaults below cover the 09 §2 catalogue's core rows.
 * Value slabs are inclusive ceilings: pick the FIRST slab where value <= maxPaise
 * (maxPaise null = unlimited). Exceeding every slab requires a Tier-3+ board note —
 * `resolveApproval` throws so the caller surfaces it as an explicit exception.
 */

export interface ApprovalSlab {
  /** inclusive ceiling in paise; null = unlimited */
  maxPaise: bigint | null;
  approverRole: string;
}

export interface MatrixEntry {
  action: string; // e.g. "sales.discount"
  slabs: ApprovalSlab[]; // ascending by maxPaise
  /** optional sequential second approver (maker-checker), e.g. payment runs */
  checkerRole?: string;
  slaMinutes: number;
  escalateToRole?: string;
}

export interface ApprovalResolution {
  approverRole: string;
  tierIndex: number;
  requiresChecker: boolean;
  slaMinutes: number;
  escalateToRole?: string;
}

export function resolveApproval(entry: MatrixEntry, value: Money): ApprovalResolution {
  for (let i = 0; i < entry.slabs.length; i++) {
    const slab = entry.slabs[i]!;
    if (slab.maxPaise === null || value.lte(Money.fromPaise(slab.maxPaise))) {
      return {
        approverRole: slab.approverRole,
        tierIndex: i,
        requiresChecker: !!entry.checkerRole,
        slaMinutes: entry.slaMinutes,
        escalateToRole: entry.escalateToRole,
      };
    }
  }
  throw new RangeError(
    `value ${value.formatIndian()} exceeds every approval tier for "${entry.action}" — board note required (09 §2)`,
  );
}

/** Seeded defaults — `09-approval-system.md §2` (amounts for a ₹500 Cr developer). */
export const SEED_MATRIX: MatrixEntry[] = [
  {
    action: "sales.discount",
    slaMinutes: 24 * 60,
    escalateToRole: "sales_head",
    slabs: [
      { maxPaise: 500_00_00n, approverRole: "sales_manager" }, // ≤5%
      { maxPaise: 800_00_00n, approverRole: "cfo" }, // ≤8%
      { maxPaise: 1200_00_00n, approverRole: "md" }, // ≤12%
    ],
  },
  {
    action: "finance.refund",
    slaMinutes: 24 * 60,
    slabs: [
      { maxPaise: 500_000_00n, approverRole: "finance_manager" }, // ≤₹5L
      { maxPaise: 50_00_000_00n, approverRole: "cfo" }, // ≤₹50L
      { maxPaise: null, approverRole: "md" },
    ],
  },
  {
    action: "procurement.po",
    slaMinutes: 72 * 60,
    escalateToRole: "cfo",
    slabs: [
      { maxPaise: 100_000_000_00n, approverRole: "procurement_manager" }, // ≤₹1Cr
      { maxPaise: 500_000_000_00n, approverRole: "cfo" }, // ≤₹5Cr
      { maxPaise: null, approverRole: "md" },
    ],
  },
  {
    action: "finance.paymentrun",
    slaMinutes: 24 * 60,
    checkerRole: "cfo", // maker FM → checker CFO (SoD hard rule)
    slabs: [{ maxPaise: null, approverRole: "finance_manager" }],
  },
  {
    action: "compliance.qpr",
    slaMinutes: 30 * 24 * 60,
    slabs: [{ maxPaise: null, approverRole: "compliance_head" }],
  },
  {
    action: "hr.payroll",
    slaMinutes: 48 * 60,
    checkerRole: "cfo",
    slabs: [{ maxPaise: null, approverRole: "hr_manager" }],
  },
];

export function matrixFor(matrix: MatrixEntry[], action: string): MatrixEntry {
  const entry = matrix.find((m) => m.action === action);
  if (!entry) throw new RangeError(`no authority matrix entry for action "${action}"`);
  return entry;
}
