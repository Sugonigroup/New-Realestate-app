import { describe, expect, it, vi } from "vitest";
import { analyzeDelay, analyzeCostBreach, assembleDailyBrief } from "./cores.js";
import { AgentRuntime } from "../runtime.js";
import { DEFAULT_POLICY } from "../policy.js";
import { residentialHighriseActivities } from "../../projects/cpm.js";

describe("Schedule Agent: delay impact (08 #3)", () => {
  const base = residentialHighriseActivities();
  const baseline = 949;

  it("3-day delay on structure_rcc shifts the whole downstream chain", () => {
    const out = analyzeDelay({
      activities: base, baselineDuration: baseline,
      delayedActivityId: "structure_rcc", delayDays: 3,
    });
    expect(out.actionPayload.newDuration).toBe(baseline + 3);
    expect(out.actionPayload.impacted).toContain("cc_oc_possession");
    expect(out.risk.scheduleImpactDays).toBe(3);
  });

  it("delay absorbed by float is reported as such", () => {
    // mep_roughin has float — delaying it 3d does not move the project
    const out = analyzeDelay({
      activities: base, baselineDuration: baseline,
      delayedActivityId: "mep_roughin", delayDays: 3,
    });
    expect(out.actionPayload.newDuration).toBe(baseline);
    expect(out.recommendation).toContain("absorbed");
  });

  it("runtime routes the recovery draft as a recorded event (L3 emit_event)", async () => {
    const executor = vi.fn(async () => {});
    const rt = new AgentRuntime({ shadowMode: true, policy: DEFAULT_POLICY }, executor);
    const out = analyzeDelay({
      activities: base, baselineDuration: baseline,
      delayedActivityId: "structure_rcc", delayDays: 40, // > 30d → S1
    });
    const run = await rt.run({
      tenantId: "t-1", agentCode: "schedule_agent", triggerType: "event",
      triggerEventId: "activity.delayed:structure_rcc", computation: out,
    });
    // emit_event is L3 but schedule_agent ceiling is 2 → policy downgrades to draft; shadow suppresses execution
    expect(run.decisions[0]!.policyVerdict.verdict).toBe("DOWNGRADE_DRAFT");
    expect(run.actions[0]!.status).toBe("drafted"); // shadow: no side effect
  });
});

describe("Cost Control Agent: EAC breach (08 #8)", () => {
  it("flags overrun and proposes budget revision (L4 → approval)", async () => {
    const out = analyzeCostBreach({
      bac: 1_000_000_000_00n, pv: 500_000_000_00n, ev: 400_000_000_00n, ac: 480_000_000_00n,
      projectId: "proj-1",
    });
    expect(out.observation).toHaveProperty("eacFormatted");
    expect(out.risk.financialImpactPaise).toBeGreaterThan(0n);
    expect(out.actionType).toBe("propose_budget_revision");

    const executor = vi.fn(async () => {});
    const rt = new AgentRuntime({ shadowMode: false, policy: DEFAULT_POLICY }, executor);
    const run = await rt.run({
      tenantId: "t-1", agentCode: "cost_control_agent", triggerType: "cron", computation: out,
    });
    // propose_budget_revision is L4 → human approval mandatory, even live
    expect(run.decisions[0]!.policyVerdict.verdict).toBe("APPROVAL_REQUIRED");
    expect(run.actions[0]!.status).toBe("pending_approval");
    expect(executor).not.toHaveBeenCalled();
  });

  it("within-budget forecast is informational only", () => {
    const out = analyzeCostBreach({
      bac: 1_000_000_000_00n, pv: 500_000_000_00n, ev: 520_000_000_00n, ac: 500_000_000_00n,
      projectId: "proj-1",
    });
    expect(out.actionType).toBe("emit_event");
    expect(out.risk.financialImpactPaise).toBe(0n);
  });
});

describe("Management Intelligence Agent: daily brief (08 #12)", () => {
  it("assembles sections with severity from risk count", () => {
    const out = assembleDailyBrief({
      generatedAt: new Date("2026-09-30T01:00:00Z"),
      sections: [
        { title: "Collections", asOf: new Date("2026-09-30T00:30:00Z"), rows: [{ label: "MTD", value: "₹48.2 Cr" }] },
        { title: "Risks", asOf: new Date("2026-09-30T00:30:00Z"), rows: [{ label: "Escrow drift", value: "Verde" }, { label: "Cost overrun", value: "Atrium" }] },
      ],
    });
    expect(out.risk.severity).toBe(2);
    expect(out.actionType).toBe("generate_report");
    expect(out.observation.staleness).toEqual([]);
  });

  it("runtime records the brief (management agent ceiling L2, generate_report is L3 → downgrade to record)", async () => {
    const executor = vi.fn(async () => {});
    const rt = new AgentRuntime({ shadowMode: false, policy: DEFAULT_POLICY }, executor);
    const out = assembleDailyBrief({
      generatedAt: new Date("2026-09-30T01:00:00Z"),
      sections: [{ title: "Collections", asOf: new Date("2026-09-30T00:30:00Z"), rows: [{ label: "MTD", value: "₹48.2 Cr" }] }],
    });
    const run = await rt.run({ tenantId: "t-1", agentCode: "management_agent", triggerType: "cron", computation: out });
    // management_agent ceiling is 2 — generate_report is L3 → DOWNGRADE_DRAFT (recorded, not executed)
    expect(run.decisions[0]!.policyVerdict.verdict).toBe("DOWNGRADE_DRAFT");
    expect(run.actions[0]!.status).toBe("drafted");
  });
});
