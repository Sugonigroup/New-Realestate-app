import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, isHoldExpired } from "./unit-state.js";

describe("unit state machine (FR-3.1)", () => {
  it("allows the commercial path: available→held→booked→registered", () => {
    expect(canTransition("available", "held")).toBe(true);
    expect(canTransition("held", "booked")).toBe(true);
    expect(canTransition("booked", "registered")).toBe(true);
    expect(() => assertTransition("available", "booked")).toThrow(RangeError); // must hold first
    expect(() => assertTransition("registered", "available")).toThrow(RangeError); // terminal
  });

  it("cancellation releases inventory; blocked units can convert on approval", () => {
    expect(canTransition("booked", "cancelled")).toBe(true);
    expect(canTransition("cancelled", "available")).toBe(true);
    expect(canTransition("blocked", "booked")).toBe(true);
    expect(canTransition("blocked", "registered")).toBe(false);
  });

  it("hold expiry releases back to available", () => {
    const heldAt = new Date("2026-09-01T04:00:00Z");
    expect(isHoldExpired(heldAt, 24, new Date(heldAt.getTime() + 23 * 3_600_000))).toBe(false);
    expect(isHoldExpired(heldAt, 24, new Date(heldAt.getTime() + 25 * 3_600_000))).toBe(true);
  });
});
