import { describe, expect, it } from "vitest";
import { profileFor, qprPeriodFor } from "./state-profiles.js";
import { draftQpr, exportBundle, assertRegistrationInCreative, assertDisclosureMirror, qprTransition, type QprSourceData } from "./qpr.js";
import { generateMonthlyItems, scanOverdue, dsarTransition, erasureCarveouts } from "./statutory.js";

const source: QprSourceData = {
  physicalCompletionPct: 42.5,
  milestonesCertified: ["plinth", "slab_3"],
  unitsSanctioned: 200,
  unitsBookedQuarter: 34,
  unitsBookedCumulative: 121,
  cancellationsQuarter: 2,
  areaBookedSqm: 8421.5,
  collectedPaise: 1_200_000_000_00n,
  demandedPaise: 1_500_000_000_00n,
  escrowBalancePaise: 840_000_000_00n,
  withdrawnPaise: 360_000_000_00n,
  litigation: [{ caseNo: "CC/2026/441", status: "pending" }],
  newApprovals: ["FIRE-NOC-2026"],
  activeAgents: ["A12345", "A67890"],
  progressPhotos: ["p1", "p2", "p3", "p4"],
};

describe("state profiles (12 §2)", () => {
  it("resolves known states with their differences", () => {
    expect(profileFor("MH").authority).toBe("MahaRERA");
    expect(profileFor("TN").qpr.cadence).toBe("half_yearly");
    expect(profileFor("UP").complaintFeeRupees).toBe(2000);
  });

  it("refuses unknown states — profile creation is a gated task", () => {
    expect(() => profileFor("XX")).toThrow(/no RERA state profile/);
  });

  it("QPR periods: quarterly vs half-yearly", () => {
    const midAug = new Date("2026-08-15");
    expect(qprPeriodFor("MH", midAug)).toMatchObject({ year: 2026, period: "Q3" });
    expect(qprPeriodFor("TN", midAug)).toMatchObject({ year: 2026, period: "H2" });
  });
});

describe("QPR engine (WP-4B)", () => {
  it("auto-fills the MahaRERA quarterly draft from live data", () => {
    const { payload, autofillPct } = draftQpr("MH", new Date("2026-08-15"), source, "P52100047382");
    expect(payload.authority).toBe("MahaRERA");
    expect(payload.fields).toHaveProperty("sales");
    expect((payload.fields.sales as Record<string, unknown>).units_booked_cumulative).toBe(121);
    expect(payload.fields).not.toHaveProperty("complaints"); // not in MH section list
    expect(autofillPct).toBeGreaterThanOrEqual(90);
  });

  it("flags manual gaps instead of hiding them", () => {
    const { manualGaps } = draftQpr("MH", new Date("2026-08-15"), { ...source, progressPhotos: ["p1"] }, "P52100047382");
    expect(manualGaps.some((g) => g.includes("photos"))).toBe(true);
  });

  it("review workflow enforces maker→checker→submit→filed", () => {
    expect(() => qprTransition("draft", "submitted")).toThrow(/illegal/);
    expect(() => qprTransition("in_review", "draft")).not.toThrow(); // checker sends back
    qprTransition("draft", "in_review");
    expect(() => qprTransition("in_review", "filed")).toThrow(/illegal/);
  });

  it("export bundle is named per authority and serializable", () => {
    const { payload } = draftQpr("KA", new Date("2026-08-15"), source, "PRM/KA/RERA/1");
    const bundle = exportBundle(payload);
    expect(bundle.filename).toBe("K-RERA_2026_Q3.json");
    expect(() => JSON.parse(bundle.json)).not.toThrow();
  });

  it("advertisement and disclosure gates (BR-C, s.11(2))", () => {
    expect(() => assertRegistrationInCreative("Book now! Luxurious 3BHKs", "P52100047382")).toThrow(/Section 11\(2\)/);
    expect(() => assertRegistrationInCreative("3BHKs — P52100047382", "P52100047382")).not.toThrow();
    expect(() =>
      assertDisclosureMirror(
        { pricePaise: 100n, carpetSqm: 68, committedDate: "2027-12" },
        { pricePaise: 100n, carpetSqm: 68, committedDate: "2027-12" },
      ),
    ).not.toThrow();
    expect(() =>
      assertDisclosureMirror(
        { pricePaise: 90n, carpetSqm: 68, committedDate: "2027-12" },
        { pricePaise: 100n, carpetSqm: 68, committedDate: "2027-12" },
      ),
    ).toThrow(/price/);
  });
});

describe("statutory calendar (WP-4C)", () => {
  it("generates the month's items with correct due dates", () => {
    const items = generateMonthlyItems(2026, 7); // August 2026
    const gst = items.find((i) => i.kind === "gst")!;
    expect(gst.dueOn).toEqual(new Date(Date.UTC(2026, 8, 11))); // 11 Sep for Aug period
    expect(items.find((i) => i.kind === "tds")!.dueOn).toEqual(new Date(Date.UTC(2026, 8, 7)));
  });

  it("overdue scan escalates to the right role, worst first", () => {
    const now = new Date("2026-09-20");
    const items = [
      ...generateMonthlyItems(2026, 6).map((i) => ({ ...i, status: "open" as const })), // July → overdue
      ...generateMonthlyItems(2026, 7).map((i) => ({ ...i, status: "filed" as const })), // Aug → filed
    ];
    const overdue = scanOverdue(items, now);
    expect(overdue[0]!.daysOverdue).toBeGreaterThan(overdue[overdue.length - 1]!.daysOverdue);
    expect(overdue.every((o) => o.escalateTo)).toBe(true);
  });
});

describe("DPDP DSAR workflow (WP-4E)", () => {
  it("enforces received → in_progress → completed", () => {
    expect(() => dsarTransition("received", "completed")).toThrow(/illegal/);
    expect(() => dsarTransition("in_progress", "partially_completed")).not.toThrow();
  });

  it("erasure honors statutory carve-outs (7y audit/finance/RERA)", () => {
    const out = erasureCarveouts(["marketing_profile", "finance_ledger", "rera_filings", "support_tickets"]);
    expect(out.erasable).toEqual(["marketing_profile", "support_tickets"]);
    expect(out.retained).toEqual(["finance_ledger", "rera_filings"]);
  });
});
