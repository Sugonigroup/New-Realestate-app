import { Money } from "@buildos/money-utils";

/**
 * India payroll engine (WP-4G, FR-9.3): statutory computation in exact paise.
 * Rates/ceilings are effective-dated configuration — the seeded defaults below
 * reflect common 2025-26 values and are consultant-validated per tenant.
 * Dual control (draft → approve → disburse) lives in the service layer (09 §2).
 */

export interface SalaryStructure {
  basicMonthly: bigint; // paise
  hraMonthly: bigint;
  specialMonthly: bigint;
}

export interface PayrollInput {
  structure: SalaryStructure;
  daysInMonth: number;
  paidDays: number; // after LOP
  stateCode: "KA" | "MH" | "TN" | "TG" | "UP";
  /** employee's annual tax declarations (80C etc.) — defaults: 80C ₹1.5L */
  annualDeductionsPaise?: bigint;
}

export interface PayrollResult {
  earnedBasicPaise: bigint;
  earnedGrossPaise: bigint;
  pfEmployeePaise: bigint;
  pfEmployerPaise: bigint;
  esicEmployeePaise: bigint;
  esicEmployerPaise: bigint;
  ptPaise: bigint;
  tdsPaise: bigint;
  netPaise: bigint;
  notes: string[];
}

const PF_WAGE_CEILING = 1_500_000n; // ₹15,000
const PF_RATE_BPS = 1200; // 12%
const ESIC_GROSS_LIMIT = 2_100_000n; // ₹21,000
const ESIC_EMPLOYEE_BPS = 75; // 0.75%
const ESIC_EMPLOYER_BPS = 325; // 3.25%
const STANDARD_DEDUCTION = 5_000_000n; // ₹50,000
const DEFAULT_80C = 15_000_000n; // ₹1,50,000

/** Professional tax slabs (monthly gross paise → amount), per state. */
const PT_SLABS: Record<string, Array<{ min: bigint; amount: bigint }>> = {
  KA: [{ min: 2_500_000n, amount: 20_000n }], // ≥₹25,000 → ₹200
  MH: [
    { min: 1_200_000n, amount: 15_000n }, // ≥₹12,000 → ₹150 (men)
    { min: 750_000n, amount: 0n },
  ],
  TN: [{ min: 12_500_000n, amount: 20_800n }], // ≥₹1,25,000 → ₹208
  TG: [{ min: 2_000_000n, amount: 20_000n }],
  UP: [{ min: 1_000_000n, amount: 20_000n }],
};

const bpsOf = (base: bigint, bps: number): bigint => (base * BigInt(bps)) / 10_000n;

/** Annual TDS (old regime, salaried) — slab + 4% cess + 87A rebate (taxable ≤ ₹5L → nil). */
function annualTds(taxableAnnualPaise: bigint): bigint {
  if (taxableAnnualPaise <= 500_000_00n) return 0n; // Section 87A rebate
  const slabs: Array<{ upto: bigint | null; rateBps: number }> = [
    { upto: 250_000_00n, rateBps: 0 },
    { upto: 500_000_00n, rateBps: 500 },
    { upto: 1_000_000_00n, rateBps: 2000 },
    { upto: null, rateBps: 3000 },
  ];
  let tax = 0n;
  let lower = 0n;
  for (const slab of slabs) {
    const upper = slab.upto ?? null;
    if (taxableAnnualPaise <= lower) break;
    const sliceUpper = upper === null ? taxableAnnualPaise : upper < taxableAnnualPaise ? upper : taxableAnnualPaise;
    tax += bpsOf(sliceUpper - lower, slab.rateBps);
    lower = sliceUpper;
    if (upper !== null && upper >= taxableAnnualPaise) break;
  }
  return tax + bpsOf(tax, 400); // 4% health & education cess added to slab tax
}

export function computePayroll(input: PayrollInput): PayrollResult {
  const notes: string[] = [];
  const { daysInMonth, paidDays } = input;
  if (daysInMonth <= 0 || paidDays < 0 || paidDays > daysInMonth) {
    throw new RangeError(`invalid paid days: ${paidDays}/${daysInMonth}`);
  }
  const scale = BigInt(daysInMonth) * 10_000_000n;
  const prorate = (monthly: bigint): bigint => (monthly * BigInt(paidDays) * 10_000_000n) / scale;

  const earnedBasic = prorate(input.structure.basicMonthly);
  const earnedHra = prorate(input.structure.hraMonthly);
  const earnedSpecial = prorate(input.structure.specialMonthly);
  const earnedGross = earnedBasic + earnedHra + earnedSpecial;

  // PF on (basic+da) capped at the wage ceiling
  const pfWage = earnedBasic <= PF_WAGE_CEILING ? earnedBasic : PF_WAGE_CEILING;
  if (earnedBasic > PF_WAGE_CEILING) notes.push(`PF wage capped at ₹15,000 (earned basic ₹${Money.fromPaise(earnedBasic).formatIndian()})`);
  const pfEmployee = bpsOf(pfWage, PF_RATE_BPS);
  const pfEmployer = bpsOf(pfWage, PF_RATE_BPS);

  // ESIC only below the gross limit
  let esicEmployee = 0n;
  let esicEmployer = 0n;
  if (earnedGross <= ESIC_GROSS_LIMIT) {
    esicEmployee = bpsOf(earnedGross, ESIC_EMPLOYEE_BPS);
    esicEmployer = bpsOf(earnedGross, ESIC_EMPLOYER_BPS);
  } else {
    notes.push("ESIC not applicable (gross above ₹21,000)");
  }

  // Professional tax by state slab on monthly gross
  const slabs = PT_SLABS[input.stateCode] ?? [];
  const pt = slabs.reverse().find((s) => earnedGross >= s.min)?.amount ?? 0n;

  // TDS: annualized taxable = gross×12 − std deduction − employee PF − declarations
  const annualDeductions = (input.annualDeductionsPaise ?? DEFAULT_80C) + pfEmployee * 12n + STANDARD_DEDUCTION;
  const annualGross = earnedGross * 12n;
  const taxable = annualGross > annualDeductions ? annualGross - annualDeductions : 0n;
  const tds = annualTds(taxable) / 12n;

  const net = earnedGross - pfEmployee - esicEmployee - pt - tds;
  return {
    earnedBasicPaise: earnedBasic,
    earnedGrossPaise: earnedGross,
    pfEmployeePaise: pfEmployee,
    pfEmployerPaise: pfEmployer,
    esicEmployeePaise: esicEmployee,
    esicEmployerPaise: esicEmployer,
    ptPaise: pt,
    tdsPaise: tds,
    netPaise: net,
    notes,
  };
}
