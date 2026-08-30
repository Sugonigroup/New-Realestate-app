import { describe, expect, it, vi } from "vitest";
import { EventDispatcher, type DomainEvent } from "./dispatch.js";
import { AgentRuntime } from "./runtime.js";
import { DEFAULT_POLICY } from "./policy.js";

function makeDispatcher() {
  const executed: Array<{ tool: string; args: Record<string, unknown> }> = [];
  const runtime = new AgentRuntime({ shadowMode: true, policy: DEFAULT_POLICY }, async (tool, args) => {
    executed.push({ tool, args });
  });
  return { dispatcher: new EventDispatcher(runtime), executed };
}

describe("event dispatcher (Phase 7 wiring)", () => {
  it("routes bill.submitted to the billing agent; clean bills short-circuit", async () => {
    const { dispatcher } = makeDispatcher();

    const dirty: DomainEvent = {
      id: "e1",
      tenantId: "t-1",
      type: "bill.submitted",
      payload: {
        raBillId: "rb-1",
        billQty: 120, billRatePaise: 8_200_000n, mbQty: 100, boqQty: 500, boqRatePaise: 8_200_000n,
        cumulativeBilledQty: 120, soeQty: 500, mbHashes: [], priorMbHashes: [],
      },
    };
    const out = await dispatcher.dispatch(dirty);
    expect(out.unrouted).toBe(false);
    expect(out.runs).toHaveLength(1);
    expect(out.runs[0]!.agentCode).toBe("billing_verification_agent");
    expect(out.runs[0]!.decisions[0]!.recommendation).toContain("quantity_mismatch");

    const clean: DomainEvent = { ...dirty, id: "e2", payload: { ...dirty.payload, billQty: 100, cumulativeBilledQty: 100 } };
    const out2 = await dispatcher.dispatch(clean);
    expect(out2.runs).toHaveLength(0); // clean bill → computation null → nothing recorded
    expect(out2.unrouted).toBe(false);
  });

  it("routes activity.delayed to the schedule agent with CPM impact", async () => {
    const { dispatcher } = makeDispatcher();
    const base = [
      { id: "A", durationDays: 3, deps: [] },
      { id: "B", durationDays: 5, deps: ["A"] },
      { id: "D", durationDays: 4, deps: ["B"] },
    ];
    const out = await dispatcher.dispatch({
      id: "e3", tenantId: "t-1", type: "activity.delayed",
      payload: { activities: base, baselineDuration: 12, delayedActivityId: "B", delayDays: 6 },
    });
    expect(out.runs[0]!.agentCode).toBe("schedule_agent");
    expect(out.runs[0]!.decisions[0]!.actionPayload.newDuration).toBe(18);
  });

  it("safety incidents route to CAPA planning with severity from classification", async () => {
    const { dispatcher } = makeDispatcher();
    const out = await dispatcher.dispatch({
      id: "e4", tenantId: "t-1", type: "safety.incident_created",
      payload: { incidentId: "inc-9", projectId: "p1", severity: "major", description: "fall near shaft" },
    });
    expect(out.runs[0]!.agentCode).toBe("safety_agent");
    expect(out.runs[0]!.decisions[0]!.risk.severity).toBe(1); // major
  });

  it("unknown event types are unrouted no-ops", async () => {
    const { dispatcher } = makeDispatcher();
    const out = await dispatcher.dispatch({ id: "e5", tenantId: "t-1", type: "coffee.machine.empty", payload: {} });
    expect(out.unrouted).toBe(true);
    expect(out.runs).toHaveLength(0);
  });
});
