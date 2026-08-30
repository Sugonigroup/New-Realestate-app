import { describe, expect, it, vi } from "vitest";
import { evaluatePolicy, DEFAULT_POLICY, type PolicyConfig } from "./policy.js";
import { AGENT_MAP, TOOL_CATALOG, agentFor, toolFor } from "./registry.js";
import { LlmGateway, maskPii, BudgetExceededError, DeterministicProvider } from "./gateway.js";
import { verifyBill } from "./agents/billing-verification.js";
import { forecastShortages } from "./agents/material-intelligence.js";
import { AgentRuntime } from "./runtime.js";

describe("autonomy policy engine (10 §3 matrix)", () => {
  const agent = agentFor("billing_verification_agent");
  const cfg: PolicyConfig = DEFAULT_POLICY;

  it("L5 tools are DENIED even if allowlisted (never autonomous)", () => {
    // hypothetical misconfiguration: an agent allowlists an L5 tool — the gate still refuses
    const rogue = { code: "rogue", name: "Rogue", ceiling: 5 as const, tools: ["approve_ra_bill"], dailyBudgetPaise: 0n, triggers: [] };
    const v = evaluatePolicy(
      { agentCode: rogue.code, tool: "approve_ra_bill", confidence: 0.99, severity: 0, argsValid: true },
      rogue,
      toolFor("approve_ra_bill"),
      cfg,
    );
    expect(v.verdict).toBe("DENY");
    expect(v.level).toBe(5);
    // and no real agent allowlists any L5 tool
    for (const a of AGENT_MAP.values()) {
      for (const t of a.tools) expect(TOOL_CATALOG[t]!.gate, `${a.code}:${t}`).not.toBe("L5");
    }
  });

  it("allowlist violation → DENY", () => {
    const v = evaluatePolicy(
      { agentCode: agent.code, tool: "read_kpis", confidence: 0.9, severity: 2, argsValid: true },
      agent,
      toolFor("read_kpis"),
      cfg,
    );
    expect(v.verdict).toBe("DENY"); // billing agent has no read_kpis in its allowlist
  });

  it("L4 tool → APPROVAL_REQUIRED regardless of confidence", () => {
    const v = evaluatePolicy(
      { agentCode: agent.code, tool: "flag_bill_anomaly", confidence: 0.99, severity: 0, argsValid: true },
      agent,
      toolFor("flag_bill_anomaly"),
      cfg,
    );
    expect(v.verdict).toBe("APPROVAL_REQUIRED");
    expect(v.level).toBe(4);
  });

  it("authority-matrix action classes override tool gates to L4", () => {
    const pm = agentFor("schedule_agent");
    const v = evaluatePolicy(
      { agentCode: pm.code, tool: "propose_baseline_revision", confidence: 0.99, severity: 1, actionClass: "projects.baseline", argsValid: true },
      pm,
      toolFor("propose_baseline_revision"),
      cfg,
    );
    expect(v.verdict).toBe("APPROVAL_REQUIRED");
  });

  it("L3 executes at high confidence within severity; downgrades otherwise", () => {
    const safety = agentFor("safety_agent");
    const ok = evaluatePolicy(
      { agentCode: safety.code, tool: "create_task", confidence: 0.9, severity: 2, argsValid: true },
      safety,
      toolFor("create_task"),
      cfg,
    );
    expect(ok.verdict).toBe("EXECUTE");
    const low = evaluatePolicy(
      { agentCode: safety.code, tool: "create_task", confidence: 0.6, severity: 2, argsValid: true },
      safety,
      toolFor("create_task"),
      cfg,
    );
    expect(low.verdict).toBe("DOWNGRADE_DRAFT");
    const severe = evaluatePolicy(
      { agentCode: safety.code, tool: "create_task", confidence: 0.95, severity: 4, argsValid: true },
      safety,
      toolFor("create_task"),
      cfg,
    );
    expect(severe.verdict).toBe("DOWNGRADE_DRAFT");
  });

  it("agent ceiling caps autonomy (ceiling-1 agent never executes L3)", () => {
    const contractor = agentFor("contractor_agent"); // ceiling 1, has notify_role (L3)
    const v = evaluatePolicy(
      { agentCode: contractor.code, tool: "notify_role", confidence: 0.99, severity: 2, argsValid: true },
      contractor,
      toolFor("notify_role"),
      cfg,
    );
    expect(v.verdict).toBe("DOWNGRADE_DRAFT");
  });

  it("registry has all 12 agents and every agent's tools exist in the catalog", () => {
    expect(AGENT_MAP.size).toBe(12);
    for (const a of AGENT_MAP.values()) {
      for (const t of a.tools) expect(TOOL_CATALOG[t], `${a.code}:${t}`).toBeDefined();
      expect(a.ceiling).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("LLM gateway (16 §5, 28)", () => {
  it("masks Aadhaar/PAN/account numbers before any model call", async () => {
    const provider = new DeterministicProvider();
    const complete = vi.spyOn(provider, "complete");
    const gw = new LlmGateway(provider, 10_000_000n);
    await gw.complete({
      taskClass: "reason",
      agentCode: "cost_control_agent",
      prompt: "Aadhaar 1234 5678 9012, PAN ABCDE1234F, account 123456789 — assess variance",
      maxTokens: 100,
    });
    const promptArg = complete.mock.calls[0]![0] as string;
    expect(promptArg).toContain("[AADHAAR_MASKED]");
    expect(promptArg).toContain("[PAN_MASKED]");
    expect(promptArg).toContain("[ACCOUNT_MASKED]");
    expect(promptArg).not.toContain("123456789012");
    expect(promptArg).not.toContain("ABCDE1234F");
  });

  it("enforces per-agent daily budgets", async () => {
    const costly = { model: "test", costPer1kTokensPaise: 1000n, complete: async () => ({ text: "x", tokensIn: 100, tokensOut: 100 }) };
    const gw = new LlmGateway(costly, 1n); // 1 paise budget, each call costs 200 paise
    await gw.complete({ taskClass: "chat", agentCode: "management_agent", prompt: "x", maxTokens: 10 });
    await expect(
      gw.complete({ taskClass: "chat", agentCode: "management_agent", prompt: "y", maxTokens: 10 }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
  });
});

describe("Billing Verification Agent (08 #7) — deterministic core", () => {
  const base = {
    billQty: 100, billRatePaise: 8_200_000n, mbQty: 100, boqQty: 500, boqRatePaise: 8_200_000n,
    cumulativeBilledQty: 100, soeQty: 500, mbHashes: ["h1", "h2"], priorMbHashes: [],
  };

  it("clean bill → approve with high confidence and computation evidence", () => {
    const r = verifyBill(base);
    expect(r.recommendation).toBe("approve");
    expect(r.anomalies).toHaveLength(0);
    expect(r.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it("catches quantity mismatch beyond tolerance → query", () => {
    const r = verifyBill({ ...base, billQty: 120 });
    expect(r.anomalies[0]).toMatchObject({ kind: "quantity_mismatch" });
    expect(r.recommendation).toBe("query");
  });

  it("catches rate inflation → reject (AI never approves payment)", () => {
    const r = verifyBill({ ...base, billRatePaise: 9_000_000n });
    expect(r.anomalies[0]).toMatchObject({ kind: "rate_mismatch" });
    expect(r.recommendation).toBe("reject");
  });

  it("catches duplicate measurement claims and cumulative overbilling", () => {
    const r = verifyBill({ ...base, mbHashes: ["h1", "h1-dup"], priorMbHashes: ["h1-dup"], cumulativeBilledQty: 600 });
    expect(r.anomalies.some((a) => a.kind === "duplicate_claim")).toBe(true);
    expect(r.anomalies.some((a) => a.kind === "overbilling")).toBe(true);
    expect(r.recommendation).toBe("reject");
  });
});

describe("Material Intelligence Agent (08 #5)", () => {
  it("predicts shortage when cover < lead time + safety; drafts PR payload", () => {
    const out = forecastShortages({
      positions: [
        { materialId: "cement", materialName: "OPC 53", stockQty: 200, avgDailyConsumption: 40, inboundPoQty: 0, leadTimeDays: 7, safetyDays: 3, unit: "bag" },
        { materialId: "steel", materialName: "TMT 12mm", stockQty: 5_000, avgDailyConsumption: 20, inboundPoQty: 0, leadTimeDays: 10, safetyDays: 5, unit: "kg" },
      ],
      horizonDays: 30,
    });
    expect(out).toHaveLength(1); // cement: 5d cover < 10d threshold; steel: 250d cover
    expect(out[0]).toMatchObject({ materialId: "cement", daysToStockout: 5 });
    expect(out[0]!.confidence).toBe(0.9);
  });
});

describe("Agent runtime (07 §3) — shadow mode + audit trail", () => {
  const executor = vi.fn(async () => {});
  const runtime = new AgentRuntime({ shadowMode: true, policy: DEFAULT_POLICY }, executor);

  it("runs a billing verification computation through the full audit pipeline", async () => {
    const run = await runtime.run({
      tenantId: "t-1",
      agentCode: "billing_verification_agent",
      triggerType: "event",
      triggerEventId: "bill.submitted:rb-42",
      computation: {
        observation: { billQty: 120, mbQty: 100 },
        risk: { severity: 1, financialImpactPaise: 1_640_000_00n },
        recommendation: "query the 20% quantity variance before approval",
        actionType: "flag_bill_anomaly",
        actionPayload: { raBillId: "rb-42", anomalies: [{ kind: "quantity_mismatch" }] },
        confidence: 0.75,
        evidence: [{ type: "computation", ref: "3-way-match:bill120/mb100" }],
      },
    });
    expect(run.status).toBe("completed");
    expect(run.decisions[0]!.policyVerdict.verdict).toBe("APPROVAL_REQUIRED");
    expect(run.actions[0]!.status).toBe("drafted"); // shadow mode: drafted, not queued
    expect(executor).not.toHaveBeenCalled(); // no side effects in shadow
    expect(run.decisions[0]!.evidence[0]!.type).toBe("computation");
  });

  it("L3 actions execute only outside shadow mode, idempotently", async () => {
    const liveRuntime = new AgentRuntime({ shadowMode: false, policy: DEFAULT_POLICY }, executor);
    const payload = { role: "site_engineer", template: "visit_reminder" };
    const computation = {
      observation: { visitId: "v-1" },
      risk: { severity: 2 } as never,
      recommendation: "send visit reminder",
      actionType: "notify_role",
      actionPayload: payload,
      confidence: 0.95,
      evidence: [{ type: "kpi" as const, ref: "visit-today" }],
    };
    const r1 = await liveRuntime.run({ tenantId: "t-1", agentCode: "safety_agent", triggerType: "cron", computation });
    expect(r1.actions[0]!.status).toBe("executed");
    expect(executor).toHaveBeenCalledTimes(1);

    // same event again → idempotent draft, no second execution
    const r2 = await liveRuntime.run({ tenantId: "t-1", agentCode: "safety_agent", triggerType: "cron", computation });
    expect(r2.actions[0]!.status).toBe("drafted");
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
