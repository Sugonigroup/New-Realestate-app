import { describe, expect, it } from "vitest";
import {
  assessPlanChange,
  classifyIncident,
  assertDrawingCurrent,
  ncrTransition,
  scanExpiries,
  snagTransition,
  supersedeDrawing,
  type ApprovalDoc,
} from "./site-ops.js";

describe("approvals expiry scan (WP-3A)", () => {
  const now = new Date("2026-09-01");
  const docs: ApprovalDoc[] = [
    { id: "a1", kind: "fire_noc", ref: "FIRE-2024-77", expiresAt: new Date("2026-08-15") }, // expired
    { id: "a2", kind: "lift_licence", ref: "LIFT-99", expiresAt: new Date("2026-09-20") }, // 19 days out
    { id: "a3", kind: "sanctioned_plan", ref: "SP-1", expiresAt: null }, // perpetual
    { id: "a4", kind: "environmental", ref: "EC-5", expiresAt: new Date("2027-06-01") }, // far out
  ];

  it("separates expired from expiring-soon, sorted nearest first", () => {
    const r = scanExpiries(docs, now, 60);
    expect(r.expired.map((d) => d.id)).toEqual(["a1"]);
    expect(r.expiringSoon.map((d) => d.id)).toEqual(["a2"]);
  });

  it("perpetual approvals are never flagged", () => {
    const r = scanExpiries([docs[2]!], now, 60);
    expect(r.expired).toHaveLength(0);
    expect(r.expiringSoon).toHaveLength(0);
  });
});

describe("plan-change RERA impact (Section 14)", () => {
  const committed = new Date("2027-12-31");

  it("no impact when dates hold", () => {
    expect(assessPlanChange({ committedCompletionDate: committed, revisedCompletionDate: committed })).toMatchObject({
      reraImpact: "none",
    });
  });

  it("slippage requires authority extension first, then buyer consent", () => {
    const revised = new Date("2028-06-30");
    const noApproval = assessPlanChange({ committedCompletionDate: committed, revisedCompletionDate: revised });
    expect(noApproval.reraImpact).toBe("authority_extension_required");

    const withApproval = assessPlanChange({
      committedCompletionDate: committed, revisedCompletionDate: revised, authorityApprovalRef: "EXT-77",
    });
    expect(withApproval.reraImpact).toBe("buyer_consent_required");

    const complete = assessPlanChange({
      committedCompletionDate: committed, revisedCompletionDate: revised,
      authorityApprovalRef: "EXT-77", buyerConsentTaken: true,
    });
    expect(complete.reraImpact).toBe("none");
  });
});

describe("NCR / snag workflows (WP-3C)", () => {
  it("NCR follows open→contained→rca→corrective→reinspection→closed", () => {
    expect(() => ncrTransition("open", "rca")).toThrow(/illegal/);
    expect(() => ncrTransition("reinspection", "closed")).not.toThrow();
  });

  it("failed reinspection loops back to corrective action", () => {
    expect(() => ncrTransition("reinspection", "corrective_action")).not.toThrow();
    expect(() => ncrTransition("closed", "open")).toThrow(/illegal/); // closed is terminal
  });

  it("snag failed verification re-raises", () => {
    expect(() => snagTransition("verified", "raised")).not.toThrow();
    expect(() => snagTransition("raised", "fixed")).toThrow(/illegal/); // must be assigned first
  });
});

describe("incident classification (11 §8)", () => {
  it("fatal/major are authority-reportable with work stoppage; near misses get CAPA too", () => {
    expect(classifyIncident("fatal")).toMatchObject({ reportableToAuthority: true, workStoppage: true, capaSlaDays: 1 });
    expect(classifyIncident("major").reportableToAuthority).toBe(true);
    expect(classifyIncident("minor").reportableToAuthority).toBe(false);
    expect(classifyIncident("near_miss").capaSlaDays).toBe(14);
  });
});

describe("drawing revision control (WP-3A)", () => {
  const revisions = [
    { rev: "R1", status: "current" as const },
  ];

  it("supersede creates the new current revision and retires the old", () => {
    const next = supersedeDrawing(revisions, "R1", "R2");
    expect(next.find((r) => r.rev === "R1")!.status).toBe("superseded");
    expect(next.find((r) => r.rev === "R2")!.status).toBe("current");
    expect(() => supersedeDrawing(next, "R1", "R3")).toThrow(/already superseded/);
  });

  it("superseded revisions block RA bill references", () => {
    const next = supersedeDrawing(revisions, "R1", "R2");
    expect(() => assertDrawingCurrent(next, "R1")).toThrow(/superseded/);
    expect(() => assertDrawingCurrent(next, "R2")).not.toThrow();
  });
});
