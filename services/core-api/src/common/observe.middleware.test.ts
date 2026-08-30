import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "./rate-limit.js";
import { redactObject } from "./log-redaction.js";

describe("rate limit middleware primitives (Phase 9 wiring)", () => {
  it("authenticated limiter allows 100/min (03 §1)", () => {
    const l = new SlidingWindowLimiter(100, 60_000);
    let blocked = false;
    for (let i = 0; i < 100; i++) blocked = !l.check("u1", i * 100).allowed;
    expect(blocked).toBe(false);
    expect(l.check("u1", 59_500).allowed).toBe(false); // within window
  });

  it("portal/IP limiter is stricter: 30/min", () => {
    const l = new SlidingWindowLimiter(30, 60_000);
    for (let i = 0; i < 30; i++) l.check("ip:1.2.3.4", i * 100);
    expect(l.check("ip:1.2.3.4", 3100).allowed).toBe(false);
  });

  it("log lines are redacted before hitting the sink", () => {
    const line = redactObject({
      path: "/v1/crm/leads?phone=%2B919876543210",
      detail: "email ravi@x.com about PAN ABCDE1234F",
    }) as Record<string, string>;
    expect(line.path).not.toContain("+919876543210");
    expect(line.detail).not.toContain("ravi@x.com");
    expect(line.detail).toContain("[PAN]");
  });
});
