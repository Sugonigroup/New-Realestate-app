import { describe, expect, it } from "vitest";
import { Money } from "@buildos/money-utils";
import { attribute, efficiency, type Touch, type BookingResult } from "../marketing/attribution.js";
import {
  collectionsKpi, contractorComposite, daysOfCover, otif, qualityMetrics,
  safetyFrequencyRate, wastagePct,
} from "./kpis.js";
import { buildBoardPack, renderPackMarkdown, packMoney } from "./report-pack.js";

describe("attribution (WP-5A)", () => {
  const touches: Touch[] = [
    { leadId: "l1", ts: new Date("2026-06-01"), channel: "meta", campaignId: "C-meta" },
    { leadId: "l1", ts: new Date("2026-06-05"), channel: "portal", campaignId: "C-portal" },
    { leadId: "l1", ts: new Date("2026-06-10"), channel: "website", campaignId: "C-web" },
  ];
  const bookings: BookingResult[] = [
    { leadId: "l1", valuePaise: 100_000_000n, bookedAt: new Date("2026-06-20") }, // ₹10L
  ];

  it("first-touch credits the earliest campaign fully", () => {
    const out = attribute(touches, bookings, "first_touch");
    expect(out.find((o) => o.campaignId === "C-meta")).toMatchObject({ bookings: 1, valuePaise: 100_000_000n });
  });

  it("last-touch credits the closing campaign", () => {
    const out = attribute(touches, bookings, "last_touch");
    expect(out.find((o) => o.campaignId === "C-web")).toMatchObject({ bookings: 1, valuePaise: 100_000_000n });
  });

  it("linear splits value exactly (₹3,33,333.34 / ₹3,33,333.33 / ₹3,33,333.33)", () => {
    const out = attribute(touches, bookings, "linear");
    const sum = out.reduce((s, o) => s + o.valuePaise, 0n);
    expect(sum).toBe(100_000_000n); // exact reconciliation
    expect(out.find((o) => o.campaignId === "C-meta")!.valuePaise).toBe(33_333_334n);
  });

  it("efficiency computes CPL/CPB, null instead of Infinity", () => {
    const rows = efficiency(
      [{ campaignId: "C-meta", spendPaise: 500_000_00n, leads: 100 }, { campaignId: "C-quiet", spendPaise: 10_000n, leads: 0 }],
      attribute(touches, bookings, "first_touch"),
    );
    const meta = rows.find((r) => r.campaignId === "C-meta")!;
    expect(meta.cplPaise).toBe(500_000n); // ₹5,00,000 / 100 leads = ₹5,000 CPL
    expect(meta.bookings).toBe(1);
    expect(meta.cpbPaise).toBe(500_000_00n); // ₹5L CPB
    expect(rows.find((r) => r.campaignId === "C-quiet")!.cplPaise).toBeNull();
  });
});

describe("KPI framework (WP-5B, doc 14)", () => {
  it("collections: percentage + aging buckets", () => {
    const now = new Date("2026-09-30");
    const k = collectionsKpi(
      [
        { amountPaise: 100n, paidPaise: 100n, dueDate: new Date("2026-08-01") },
        { amountPaise: 100n, paidPaise: 40n, dueDate: new Date("2026-09-20") }, // 10d late
        { amountPaise: 100n, paidPaise: 0n, dueDate: new Date("2026-07-15") }, // 77d late
      ],
      now,
    );
    expect(k.collectedPct).toBe(46.67);
    expect(k.overduePaise).toBe(160n);
    expect(k.aging.b0_30).toBe(60n);
    expect(k.aging.b61_90).toBe(100n);
  });

  it("procurement OTIF and inventory cover/wastage", () => {
    expect(otif([
      { promisedDate: new Date("2026-01-01"), receivedDate: new Date("2026-01-01"), receivedInFull: true },
      { promisedDate: new Date("2026-01-01"), receivedDate: new Date("2026-01-05"), receivedInFull: true },
      { promisedDate: new Date("2026-01-01"), receivedDate: null, receivedInFull: false },
    ])).toBe(33.33);
    expect(daysOfCover(500, 25)).toBe(20);
    expect(wastagePct(120, 100)).toBe(16.67);
    expect(wastagePct(90, 100)).toBe(0);
  });

  it("contractor composite uses the 11 §9 weights with bands", () => {
    expect(contractorComposite({ schedule: 90, quality: 85, safety: 80, cost: 70 })).toMatchObject({ score: 85, band: "A" });
    expect(contractorComposite({ schedule: 40, quality: 50, safety: 60, cost: 50 }).band).toBe("D"); // 48 → D
  });

  it("quality and safety metrics", () => {
    expect(qualityMetrics({ inspectionsDone: 18, inspectionsPlanned: 20, ncrsRaised: 10, ncrsClosed: 8, firstPassYieldPct: 92 })).toEqual({
      inspectionCompliancePct: 90, ncrClosureRatePct: 80, firstPassYieldPct: 92,
    });
    expect(safetyFrequencyRate(2, 400_000)).toBe(0.5); // per 10⁵ man-hours
  });
});

describe("board pack builder (WP-5C)", () => {
  const generatedAt = new Date("2026-09-30T04:00:00Z");
  const fresh: Parameters<typeof buildBoardPack>[1] = [
    { title: "Collections", asOf: new Date("2026-09-30T02:00:00Z"), rows: [{ label: "Collected MTD", value: packMoney(4_820_000_000n) }] },
  ];
  const stale: Parameters<typeof buildBoardPack>[1] = [
    { title: "Escrow", asOf: new Date("2026-09-28T02:00:00Z"), rows: [{ label: "Utilisation", value: "61%" }] },
  ];

  it("assembles sections with money rows; staleness renders 'data pending'", () => {
    const pack = buildBoardPack("Board Pack — Sep 2026", [...fresh, ...stale], generatedAt);
    expect(pack.stalenessFlagged).toEqual(["Escrow"]);
    const md = renderPackMarkdown(pack);
    expect(md).toContain("Collected MTD: 4,82,00,000.00");
    expect(md).toContain("pending — snapshot older than 24h");
    expect(md).toContain("Staleness flagged: Escrow");
  });

  it("Money import sanity (pack rows never lose paise)", () => {
    expect(Money.fromPaise(4_820_000_000n).formatIndian()).toBe("4,82,00,000.00");
  });
});
