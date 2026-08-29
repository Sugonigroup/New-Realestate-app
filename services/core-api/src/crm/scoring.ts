/**
 * Lead scoring v1 — rules-based (WP-1B); ML replaces the weights in Phase 5/8
 * with the same contract. Deterministic, explainable: every component returns
 * points + note. LLMs never compute the score (principle 6).
 */

export interface ScoreInput {
  source: string;
  createdDaysAgo: number;
  lastActivityDaysAgo: number | null;
  interactionCount: number;
  hasDoneVisit: boolean;
  budgetPaise: bigint | null;
  projectMinBudgetPaise: bigint | null;
}

export interface ScoreComponent {
  component: string;
  points: number;
  max: number;
  note: string;
}

export interface ScoreResult {
  score: number; // 0..100
  breakdown: ScoreComponent[];
}

const SOURCE_WEIGHTS: Record<string, number> = {
  partner: 30,
  referral: 30,
  website: 24,
  walkin: 24,
  meta_ads: 18,
  google_ads: 18,
  portal: 12,
  whatsapp: 12,
  ivr: 8,
  import: 6,
};

function sourcePoints(source: string): ScoreComponent {
  const w = SOURCE_WEIGHTS[source] ?? 8;
  return { component: "source", points: w, max: 30, note: `source=${source}` };
}

function budgetFitPoints(budget: bigint | null, minBudget: bigint | null): ScoreComponent {
  if (budget === null) return { component: "budget", points: 10, max: 25, note: "budget unknown" };
  if (minBudget === null || minBudget <= 0n) {
    return { component: "budget", points: 15, max: 25, note: "no project benchmark" };
  }
  const ratio = Number(budget) / Number(minBudget);
  if (ratio >= 1) return { component: "budget", points: 25, max: 25, note: `budget ≥ project floor (×${ratio.toFixed(2)})` };
  if (ratio >= 0.75) return { component: "budget", points: 18, max: 25, note: `budget ≈ floor (×${ratio.toFixed(2)})` };
  if (ratio >= 0.5) return { component: "budget", points: 10, max: 25, note: `budget below floor (×${ratio.toFixed(2)})` };
  return { component: "budget", points: 2, max: 25, note: `budget far below floor (×${ratio.toFixed(2)})` };
}

function engagementPoints(interactionCount: number, hasDoneVisit: boolean): ScoreComponent {
  const interactionScore = Math.min(interactionCount, 3) * 5; // 5/interaction, cap 15
  const visitScore = hasDoneVisit ? 10 : 0;
  const points = interactionScore + visitScore;
  return {
    component: "engagement",
    points,
    max: 25,
    note: `${interactionCount} interaction(s)${hasDoneVisit ? " + completed visit" : ""}`,
  };
}

function recencyPoints(lastActivityDaysAgo: number | null, createdDaysAgo: number): ScoreComponent {
  const days = lastActivityDaysAgo ?? createdDaysAgo;
  if (lastActivityDaysAgo === null) {
    return { component: "recency", points: days <= 1 ? 20 : days <= 7 ? 10 : 4, max: 20, note: "no activity yet" };
  }
  if (days <= 1) return { component: "recency", points: 20, max: 20, note: "active today" };
  if (days <= 3) return { component: "recency", points: 14, max: 20, note: "active ≤3d" };
  if (days <= 7) return { component: "recency", points: 8, max: 20, note: "active ≤7d" };
  if (days <= 14) return { component: "recency", points: 4, max: 20, note: "active ≤14d" };
  return { component: "recency", points: 0, max: 20, note: `stale ${days}d` };
}

export function scoreLead(input: ScoreInput): ScoreResult {
  const breakdown = [
    sourcePoints(input.source),
    budgetFitPoints(input.budgetPaise, input.projectMinBudgetPaise),
    engagementPoints(input.interactionCount, input.hasDoneVisit),
    recencyPoints(input.lastActivityDaysAgo, input.createdDaysAgo),
  ];
  const score = Math.min(100, breakdown.reduce((sum, b) => sum + b.points, 0));
  return { score, breakdown };
}
