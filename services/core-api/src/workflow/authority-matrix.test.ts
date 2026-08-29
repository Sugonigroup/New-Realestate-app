import { describe, expect, it } from "vitest";
import { Money } from "@buildos/money-utils";
import { SEED_MATRIX, matrixFor, resolveApproval } from "./authority-matrix.js";

const entry = matrixFor(SEED_MATRIX, "sales.discount");

describe("authority matrix resolution (09 §2)", () => {
  it("routes ≤5% discount to sales_manager", () => {
    const r = resolveApproval(entry, Money.fromPaise(500_00_00n));
    expect(r.approverRole).toBe("sales_manager");
    expect(r.requiresChecker).toBe(false);
  });

  it("routes ≤8% to cfo and ≤12% to md", () => {
    expect(resolveApproval(entry, Money.fromPaise(800_00_00n)).approverRole).toBe("cfo");
    expect(resolveApproval(entry, Money.fromPaise(1200_00_00n)).approverRole).toBe("md");
  });

  it("throws when value exceeds every tier (board note required)", () => {
    expect(() => resolveApproval(entry, Money.fromPaise(1200_00_01n))).toThrow(RangeError);
  });

  it("payment runs are maker-checker (FM makes, CFO checks — SoD)", () => {
    const pr = matrixFor(SEED_MATRIX, "finance.paymentrun");
    const r = resolveApproval(pr, Money.fromPaise(99_00_000_00n));
    expect(r.approverRole).toBe("finance_manager");
    expect(pr.checkerRole).toBe("cfo");
    expect(r.requiresChecker).toBe(true);
  });

  it("rejects unknown actions and validates inputs", () => {
    expect(() => matrixFor(SEED_MATRIX, "space.launch")).toThrow(RangeError);
    expect(() => resolveApproval(entry, Money.fromPaise(1n))).not.toThrow();
  });
});
