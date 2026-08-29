import { Money } from "@buildos/money-utils";

/** Bank/gateway reconciliation matcher (WP-2B): amount + ref containment. */

export interface StatementLine {
  utr: string;
  amountPaise: bigint;
  narration: string;
  date: Date;
}

export interface ExpectedPayment {
  bookingId: string;
  expectPaise: bigint;
  expectRef?: string; // booking code / demand no / customer phone tail
}

export interface ReconMatch {
  line: StatementLine;
  expectation: ExpectedPayment;
  score: number;
}

export interface ReconResult {
  matched: ReconMatch[];
  unmatchedLines: StatementLine[];
  unmatchedExpectations: ExpectedPayment[];
}

export function reconcile(lines: StatementLine[], expectations: ExpectedPayment[]): ReconResult {
  const used = new Set<number>();
  const matched: ReconMatch[] = [];
  for (const exp of expectations) {
    let best = -1;
    let bestScore = -1;
    lines.forEach((line, i) => {
      if (used.has(i)) return;
      if (line.amountPaise !== exp.expectPaise) return; // exact amount required for auto-match
      let score = 1;
      if (exp.expectRef && line.narration.toLowerCase().includes(exp.expectRef.toLowerCase())) score += 2;
      if (exp.expectRef && line.utr.toLowerCase().includes(exp.expectRef.toLowerCase())) score += 1;
      if (score > bestScore) {
        bestScore = score;
        best = i;
      }
    });
    if (best >= 0) {
      used.add(best);
      matched.push({ line: lines[best]!, expectation: exp, score: bestScore });
    }
  }
  return {
    matched,
    unmatchedLines: lines.filter((_, i) => !used.has(i)),
    unmatchedExpectations: expectations.filter((e) => !matched.some((m) => m.expectation === e)),
  };
}

/** Money helper for building statement fixtures. */
export function paise(rupees: string): bigint {
  return Money.fromRupees(rupees).paise;
}
