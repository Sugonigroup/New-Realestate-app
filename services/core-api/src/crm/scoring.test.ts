import { describe, expect, it } from "vitest";
import { scoreLead } from "./scoring.js";
import { JOURNEY_DEFS } from "./journeys.js";
import { advanceJourney } from "../notify/journey.js";

describe("lead scoring v1 (rules-based, explainable)", () => {
  it("a hot lead scores high with a full breakdown", () => {
    const { score, breakdown } = scoreLead({
      source: "partner",
      createdDaysAgo: 2,
      lastActivityDaysAgo: 0,
      interactionCount: 3,
      hasDoneVisit: true,
      budgetPaise: 1_20_00_000_00n,
      projectMinBudgetPaise: 1_00_00_000_00n,
    });
    expect(score).toBe(100); // 30+25+25+20
    expect(breakdown.map((b) => b.component)).toEqual(["source", "budget", "engagement", "recency"]);
    expect(breakdown[1]!.note).toContain("≥ project floor");
  });

  it("a cold stale portal lead scores low", () => {
    const { score } = scoreLead({
      source: "portal",
      createdDaysAgo: 45,
      lastActivityDaysAgo: 45,
      interactionCount: 1,
      hasDoneVisit: false,
      budgetPaise: 20_00_000_00n,
      projectMinBudgetPaise: 1_00_00_000_00n,
    });
    expect(score).toBeLessThanOrEqual(20); // 12 + 2 + 5 + 0
  });

  it("unknown budget is neutral, not zero", () => {
    const { score, breakdown } = scoreLead({
      source: "website",
      createdDaysAgo: 0,
      lastActivityDaysAgo: null,
      interactionCount: 0,
      hasDoneVisit: false,
      budgetPaise: null,
      projectMinBudgetPaise: null,
    });
    expect(breakdown.find((b) => b.component === "budget")?.points).toBe(10);
    expect(score).toBe(54); // source 24 + budget 10 + engagement 0 + recency 20
  });

  it("never exceeds 100", () => {
    const { score } = scoreLead({
      source: "partner", createdDaysAgo: 0, lastActivityDaysAgo: 0,
      interactionCount: 9, hasDoneVisit: true, budgetPaise: null, projectMinBudgetPaise: null,
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("journey definitions (WP-1B)", () => {
  it("lead_ack fires immediately", () => {
    const state = advanceJourney(JOURNEY_DEFS.lead_ack, { stepIndex: 0, status: "running", sends: [] });
    expect(state.sends).toEqual([{ stepIndex: 0, channel: "whatsapp", templateKey: "lead_ack_wa", vars: {} }]);
    expect(state.status).toBe("completed");
  });

  it("warm nurture sends D2 then waits, resumes D7, D14, stops", () => {
    let s = advanceJourney(JOURNEY_DEFS.warm_nurture, { stepIndex: 0, status: "running", sends: [] });
    expect(s.sends).toHaveLength(0);
    expect(s.nextRunAt).toBeDefined(); // parked ~2 days
    expect(s.stepIndex).toBe(1);

    s = advanceJourney(JOURNEY_DEFS.warm_nurture, s);
    expect(s.sends[0]?.templateKey).toBe("nurture_d2");
    expect(s.nextRunAt).toBeDefined();

    s = advanceJourney(JOURNEY_DEFS.warm_nurture, s);
    expect(s.sends[1]?.templateKey).toBe("nurture_d7");
    s = advanceJourney(JOURNEY_DEFS.warm_nurture, s);
    expect(s.sends[2]?.templateKey).toBe("nurture_d14");
    s = advanceJourney(JOURNEY_DEFS.warm_nurture, s);
    expect(s.status).toBe("stopped");
  });

  it("all definitions are structurally valid journeys", () => {
    for (const [key, def] of Object.entries(JOURNEY_DEFS)) {
      expect(def.steps.length, key).toBeGreaterThan(0);
      const s = advanceJourney(def, { stepIndex: 0, status: "running", sends: [] });
      expect(["running", "completed", "stopped"], key).toContain(s.status);
    }
  });
});
