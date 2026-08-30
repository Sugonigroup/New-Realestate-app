import { describe, expect, it, vi } from "vitest";
import { AgentRunRecorder } from "./ai-recorder.js";
import { AgentRuntime } from "@buildos/core-api";
import { DEFAULT_POLICY } from "@buildos/core-api";
import type { RunRecord } from "@buildos/core-api";

function makeFake() {
  const rows = { runs: [] as unknown[], decisions: [] as unknown[], actions: [] as unknown[] };
  let seq = 0;
  const prisma = {
    agentRun: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const r = { id: `ar-${++seq}`, ...data }; rows.runs.push(r); return r; }) },
    aiDecision: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const r = { id: `ad-${++seq}`, ...data }; rows.decisions.push(r); return r; }) },
    aiAction: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const r = { id: `aa-${++seq}`, ...data }; rows.actions.push(r); return r; }) },
  };
  return { prisma, rows };
}

describe("AgentRunRecorder (audit persistence, 05 §2)", () => {
  it("persists run → decisions → actions with the full audit chain", async () => {
    const { prisma, rows } = makeFake();
    const recorder = new AgentRunRecorder(prisma as never);
    const runtime = new AgentRuntime({ shadowMode: true, policy: DEFAULT_POLICY }, async () => {});

    const run: RunRecord = await runtime.run({
      tenantId: "t-1",
      agentCode: "billing_verification_agent",
      triggerType: "event",
      triggerEventId: "bill.submitted:rb-1",
      computation: {
        observation: { billQty: 120, mbQty: 100 },
        risk: { severity: 1, financialImpactPaise: 1_640_000_00n },
        recommendation: "query quantity variance",
        actionType: "flag_bill_anomaly",
        actionPayload: { raBillId: "rb-1" },
        confidence: 0.75,
        evidence: [{ type: "computation", ref: "3-way-match" }],
      },
    });

    const runId = await recorder.record(run, "deterministic-shadow-v1", "prompt-v1");
    expect(runId).toMatch(/^ar-/);
    expect(rows.runs[0]).toMatchObject({ agentCode: "billing_verification_agent", status: "completed", traceId: run.traceId });
    expect(rows.decisions[0]).toMatchObject({ actionType: "flag_bill_anomaly", confidence: 0.75 });
    expect(rows.actions[0]).toMatchObject({ executionStatus: "drafted", autonomyLevel: 4 });
  });
});
