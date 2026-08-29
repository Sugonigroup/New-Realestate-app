import { describe, expect, it } from "vitest";
import { computeCpm, residentialHighriseActivities } from "./cpm.js";
import { computeEvm } from "./evm.js";
import { evaluateCertification } from "./certification.js";

describe("CPM engine (WP-3B golden network)", () => {
  //   A(3) ──→ B(5) ──→ D(4)
  //      └──→ C(2) ──↗
  // Forward: A 0..3, B 3..8, C 3..5, D 8..12 → project = 12 d
  // Critical: A, B, D (C floats 3 d)
  const net = [
    { id: "A", durationDays: 3, deps: [] },
    { id: "B", durationDays: 5, deps: ["A"] },
    { id: "C", durationDays: 2, deps: ["A"] },
    { id: "D", durationDays: 4, deps: ["B", "C"] },
  ];

  it("computes ES/EF/LS/LF, float and critical path correctly", () => {
    const r = computeCpm(net);
    expect(r.projectDuration).toBe(12);
    expect(r.nodes.A).toMatchObject({ es: 0, ef: 3, float: 0, critical: true });
    expect(r.nodes.B).toMatchObject({ es: 3, ef: 8, float: 0, critical: true });
    expect(r.nodes.C).toMatchObject({ es: 3, ef: 5, ls: 6, float: 3, critical: false });
    expect(r.nodes.D).toMatchObject({ es: 8, ef: 12, critical: true });
    expect(r.criticalPath).toEqual(["A", "B", "D"]);
  });

  it("rejects cycles and unknown dependencies", () => {
    expect(() =>
      computeCpm([
        { id: "A", durationDays: 1, deps: ["B"] },
        { id: "B", durationDays: 1, deps: ["A"] },
      ]),
    ).toThrow(/cycle/);
    expect(() => computeCpm([{ id: "A", durationDays: 1, deps: ["ghost"] }])).toThrow(/unknown dependency/);
  });

  it("residential high-rise template computes a plausible critical path", () => {
    const r = computeCpm(residentialHighriseActivities());
    // 30+45+90+25+252 + blockwork 180 + flooring 144 + painting 108 + testing 30 + possession 45
    expect(r.projectDuration).toBe(949);
    expect(r.criticalPath[0]).toBe("mobilisation");
    expect(r.criticalPath.at(-1)).toBe("cc_oc_possession");
    expect(r.nodes.mep_roughin?.critical).toBe(false); // parallel MEP has float
  });
});

describe("EVM (11 §5)", () => {
  it("computes SPI/CPI/EAC on a known scenario", () => {
    // BAC ₹10Cr; planned ₹4Cr; earned ₹3Cr; spent ₹3.6Cr → behind & over
    const r = computeEvm({ bac: 1_000_000_000_00n, pv: 400_000_000_00n, ev: 300_000_000_00n, ac: 360_000_000_00n });
    expect(r.spi).toBeCloseTo(0.75, 3);
    expect(r.cpi).toBeCloseTo(0.8333, 3);
    expect(r.health).toBe("red");
    // EAC = 3.6Cr + (10−3)/0.8333 Cr = ₹12Cr
    expect(r.eac).toBe(1_200_000_000_00n);
    expect(r.vac).toBe(-200_000_000_00n);
  });

  it("on-track project is green", () => {
    const r = computeEvm({ bac: 1_000_000_000_00n, pv: 500_000_000_00n, ev: 500_000_000_00n, ac: 480_000_000_00n });
    expect(r.health).toBe("on_track");
  });
});

describe("milestone certification gate (11 §3)", () => {
  it("certifies only with full evidence package", () => {
    const full = {
      photoCount: 4, pourCardsClosed: true, openNcrs: 0,
      structuralCertificateRef: "F3-77", caCertificateRef: "F4-77",
    };
    expect(evaluateCertification(full)).toMatchObject({ ok: true, blockers: [] });
  });

  it("blocks on each missing piece with actionable reasons", () => {
    const d = evaluateCertification({ photoCount: 1, pourCardsClosed: false, openNcrs: 2 });
    expect(d.ok).toBe(false);
    expect(d.blockers).toHaveLength(5); // photos, pour cards, NCRs, Form 3, Form 4
    expect(d.blockers.some((b) => b.includes("photo"))).toBe(true);
    expect(d.blockers.some((b) => b.includes("pour cards"))).toBe(true);
    expect(d.blockers.some((b) => b.includes("NCR"))).toBe(true);
    expect(d.blockers.some((b) => b.includes("Form 4"))).toBe(true);
  });
});
