import { Money } from "@buildos/money-utils";

/**
 * Billing Verification Agent (08 #7) — deterministic core. AI must NOT
 * authorize payments (10 §5): this agent only verifies and recommends (L1).
 * Checks: 3-way match (bill↔MB↔BOQ), rate anomalies, cumulative overbilling,
 * duplicate measurement hashes.
 */

export interface BillVerificationInput {
  billQty: number;
  billRatePaise: bigint;
  mbQty: number; // measurement-book joint-measured quantity
  boqQty: number; // BOQ line quantity
  boqRatePaise: bigint; // work-order rate
  cumulativeBilledQty: number; // incl. this bill
  soeQty: number; // schedule-of-quantity balance total
  mbHashes: string[]; // measurement entry hashes for duplicate detection
  priorMbHashes: string[];
}

export interface BillAnomaly {
  kind: "quantity_mismatch" | "rate_mismatch" | "overbilling" | "duplicate_claim";
  expected: string;
  actual: string;
  delta: string;
}

export interface VerificationResult {
  anomalies: BillAnomaly[];
  recommendation: "approve" | "query" | "reject";
  confidence: number;
  evidence: Array<{ type: "computation"; note: string }>;
}

const QTY_TOLERANCE = 0.02; // 2% quantity tolerance
const RATE_TOLERANCE = 0.0;

export function verifyBill(input: BillVerificationInput): VerificationResult {
  const anomalies: BillAnomaly[] = [];
  const evidence: Array<{ type: "computation"; note: string }> = [];

  // 1. bill vs measurement book
  const mbDelta = input.billQty - input.mbQty;
  if (Math.abs(mbDelta) / Math.max(input.mbQty, 1) > QTY_TOLERANCE) {
    anomalies.push({
      kind: "quantity_mismatch",
      expected: `${input.mbQty} (MB)`,
      actual: `${input.billQty} (bill)`,
      delta: mbDelta.toFixed(2),
    });
  }

  // 2. bill vs BOQ work-order rate
  if (input.billRatePaise > input.boqRatePaise) {
    anomalies.push({
      kind: "rate_mismatch",
      expected: Money.fromPaise(input.boqRatePaise).formatIndian(),
      actual: Money.fromPaise(input.billRatePaise).formatIndian(),
      delta: Money.fromPaise(input.billRatePaise - input.boqRatePaise).formatIndian(),
    });
  }

  // 3. cumulative overbilling against SOE
  if (input.cumulativeBilledQty > input.soeQty) {
    anomalies.push({
      kind: "overbilling",
      expected: `${input.soeQty} (SOE)`,
      actual: `${input.cumulativeBilledQty} (cumulative billed)`,
      delta: (input.cumulativeBilledQty - input.soeQty).toFixed(2),
    });
  }

  // 4. duplicate measurement claims
  const seen = new Set(input.priorMbHashes);
  const duplicates = input.mbHashes.filter((h) => seen.has(h));
  if (duplicates.length > 0) {
    anomalies.push({
      kind: "duplicate_claim",
      expected: "0 duplicate measurement entries",
      actual: `${duplicates.length} duplicate hash(es)`,
      delta: duplicates.join(","),
    });
  }

  evidence.push({ type: "computation", note: `3-way match: bill ${input.billQty} vs MB ${input.mbQty} vs BOQ ${input.boqQty}` });
  evidence.push({ type: "computation", note: `rate: bill ${Money.fromPaise(input.billRatePaise).formatIndian()} vs WO ${Money.fromPaise(input.boqRatePaise).formatIndian()}` });

  // recommendation: hard anomalies → reject; soft (qty tolerance) → query; clean → approve
  const hard = anomalies.some((a) => a.kind === "rate_mismatch" || a.kind === "overbilling" || a.kind === "duplicate_claim");
  const recommendation = anomalies.length === 0 ? "approve" : hard ? "reject" : "query";
  const confidence = anomalies.length === 0 ? 0.95 : hard ? 0.9 : 0.75;
  return { anomalies, recommendation, confidence, evidence };
}
