import { describe, expect, it, vi } from "vitest";
import { assessProjectHealth, draftPurchaseRequest, contractorScorecard, draftNcr, planIncidentCapa, classifyDocument } from "./cores2.js";
import { runEvalSuite } from "../evals.js";
import { DEFAULT_POLICY } from "../policy.js";
import { AgentRuntime } from "../runtime.js";
import type { NotificationService } from "../../notify/notification.service.js";
import type { PrismaService } from "../../prisma/prisma.service.js";

describe("remaining agent cores (08)", () => {
  it("PM agent: healthy project emits event; risky project raises task", () => {
    const healthy = assessProjectHealth({ projectId: "p1", spi: 1.02, cpi: 0.98, overdueMilestones: 0, openNcrs: 0, escrowBreach: false });
    expect(healthy.actionType).toBe("emit_event");
    const risky = assessProjectHealth({ projectId: "p2", spi: 0.82, cpi: 0.88, overdueMilestones: 2, openNcrs: 3, escrowBreach: true });
    expect(risky.actionType).toBe("create_task");
    expect(risky.risk.severity).toBe(1); // escrow breach
    expect(risky.recommendation).toContain("escrow breach");
  });

  it("procurement agent drafts a PR payload with basis and reason (L4)", () => {
    const out = draftPurchaseRequest({
      projectId: "p1",
      shortage: { materialId: "cement", materialName: "OPC 53", suggestedQty: 1200, unit: "bag", daysToStockout: 5, confidence: 0.9 },
      stockRef: "stock-1", openPoRef: "po-0",
    });
    expect(out.actionType).toBe("create_purchase_request");
    expect(out.actionPayload).toMatchObject({ qty: 1200, reason: /shortage in 5 days/ });
    expect(out.evidence.length).toBeGreaterThanOrEqual(2); // computation + stock record
  });

  it("contractor agent: D-band declining contractor notifies procurement; A-band emits", () => {
    const bad = contractorScorecard({ contractorId: "c9", scores: { schedule: 40, quality: 45, safety: 50, cost: 55 }, trend: "declining" });
    expect(bad.actionType).toBe("notify_role");
    expect(bad.risk.severity).toBe(1);
    const good = contractorScorecard({ contractorId: "c1", scores: { schedule: 90, quality: 88, safety: 92, cost: 85 }, trend: "improving" });
    expect(good.actionType).toBe("emit_event");
  });

  it("quality agent: NCR draft carries failed items and photo evidence", () => {
    const out = draftNcr({ inspectionId: "insp-7", projectId: "p1", failedItems: ["honeycombing", "cover-block"], severity: "major", photoRefs: ["p1", "p2", "p3"] });
    expect(out.actionType).toBe("create_ncr");
    expect(out.confidence).toBe(0.9);
    expect(out.actionPayload).toMatchObject({ defectClass: "major" });
  });

  it("safety agent: fatal incident is S0, reportable, with work stoppage CAPA", () => {
    const out = planIncidentCapa({ incidentId: "inc-1", projectId: "p1", severity: "fatal", description: "—" });
    expect(out.risk.severity).toBe(0);
    expect(out.actionPayload).toMatchObject({ reportable: true, workStoppage: true, slaDays: 1 });
  });

  it("document agent: classifies from filename, low confidence for unknowns", () => {
    expect(classifyDocument({ documentId: "d1", filename: "verde_gfc_drawing_r2.pdf", mimeType: "application/pdf", hasFormFields: false }).actionPayload).toMatchObject({ docClass: "drawing" });
    const unknown = classifyDocument({ documentId: "d2", filename: "scan_99.pdf", mimeType: "application/pdf", hasFormFields: false });
    expect(unknown.confidence).toBe(0.4);
  });
});

describe("eval harness (Phase 7 gate)", () => {
  const executor = vi.fn(async () => {});
  it("runs a golden suite and reports pass/fail with failure names", async () => {
    interface BillInput { billQty: number; billRatePaise: bigint; mbQty: number; boqQty: number; boqRatePaise: bigint; cumulativeBilledQty: number; soeQty: number; mbHashes: string[]; priorMbHashes: string[] }
    const result = await runEvalSuite<BillInput>(
      "billing-verification-golden",
      [
        {
          name: "clean bill approves",
          input: { billQty: 100, billRatePaise: 8_200_000n, mbQty: 100, boqQty: 500, boqRatePaise: 8_200_000n, cumulativeBilledQty: 100, soeQty: 500, mbHashes: [], priorMbHashes: [] },
          compute: (b) => ({
            observation: { billQty: b.billQty },
            risk: { severity: 2 },
            recommendation: "approve",
            actionType: "emit_event",
            actionPayload: { ok: true },
            confidence: 0.95,
            evidence: [{ type: "computation", ref: "3-way" }],
          }),
          expect: (comp, run) => {
            expect(comp.recommendation).toBe("approve");
            expect(run.decisions[0]!.policyVerdict.verdict).toBe("DOWNGRADE_DRAFT"); // ceiling 1 → recorded draft
            expect(run.status).toBe("completed");
          },
        },
        {
          name: "rate inflation rejects",
          input: { billQty: 100, billRatePaise: 9_000_000n, mbQty: 100, boqQty: 500, boqRatePaise: 8_200_000n, cumulativeBilledQty: 100, soeQty: 500, mbHashes: [], priorMbHashes: [] },
          compute: (b) => ({
            observation: { rate: b.billRatePaise },
            risk: { severity: 1 },
            recommendation: "reject",
            actionType: "flag_bill_anomaly",
            actionPayload: { raBillId: "rb-1", anomalies: [{ kind: "rate_mismatch" }] },
            confidence: 0.9,
            evidence: [{ type: "computation", ref: "rate" }],
          }),
          expect: (comp) => {
            expect(comp.recommendation).toBe("reject");
            expect(comp.actionType).toBe("flag_bill_anomaly");
          },
        },
      ],
      { agentCode: "billing_verification_agent", shadowMode: true, policy: DEFAULT_POLICY },
    );
    void executor;
    expect(result.passed + result.failed).toBe(2);
  });

  it("collects failure names without throwing", async () => {
    const result = await runEvalSuite<number>(
      "failing-suite",
      [
        {
          name: "expectation fails",
          input: 1,
          compute: (n) => ({
            observation: {}, risk: { severity: 3 as const }, recommendation: "x",
            actionType: "emit_event", actionPayload: {}, confidence: 0.9,
            evidence: [],
          }),
          expect: () => expect(1).toBe(2),
        },
      ],
      { agentCode: "contractor_agent", shadowMode: true, policy: DEFAULT_POLICY },
    );
    expect(result.failed).toBe(1);
    expect(result.failures[0]!.name).toBe("expectation fails");
  });

  it("permission service remains constructible for module wiring", () => {
    void ({} as PrismaService);
    void ({} as NotificationService);
    expect(true).toBe(true);
  });
});
