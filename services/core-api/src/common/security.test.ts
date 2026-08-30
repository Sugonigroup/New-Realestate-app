import { describe, expect, it } from "vitest";
import { redactObject, redactPii } from "./log-redaction.js";
import { SlidingWindowLimiter } from "./rate-limit.js";

describe("log PII redaction (Phase 9)", () => {
  it("masks Aadhaar, PAN, phone, email in free text", () => {
    const out = redactPii("customer Aadhaar 1234 5678 9012 PAN ABCDE1234F phone +919876543210 email ravi@x.com");
    expect(out).toContain("[AADHAAR]");
    expect(out).toContain("[PAN]");
    expect(out).toContain("[PHONE]");
    expect(out).toContain("[EMAIL]");
    expect(out).not.toContain("1234 5678 9012");
    expect(out).not.toContain("ABCDE1234F");
    expect(out).not.toContain("ravi@x.com");
  });

  it("deep-redacts objects with sensitive keys", () => {
    const out = redactObject({
      name: "Ravi",
      password: "secret",
      pan: "ABCDE1234F",
      nested: { phone: "+919876543210", note: "call 09876543210" },
    }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.pan).toBe("[PAN]");
    expect((out.nested as Record<string, unknown>).phone).toBe("[PHONE]");
    expect((out.nested as Record<string, unknown>).note).toBe("call [PHONE]");
  });

  it("leaves clean text untouched", () => {
    expect(redactPii("booking BK-000123 confirmed for Verde Residences")).toBe(
      "booking BK-000123 confirmed for Verde Residences",
    );
  });
});

describe("sliding-window rate limiter (Phase 9)", () => {
  it("allows up to the limit then blocks with retry-after", () => {
    const limiter = new SlidingWindowLimiter(3, 60_000);
    const t0 = 1_000_000;
    expect(limiter.check("k", t0).allowed).toBe(true);
    expect(limiter.check("k", t0 + 1000).allowed).toBe(true);
    expect(limiter.check("k", t0 + 2000).allowed).toBe(true);
    const blocked = limiter.check("k", t0 + 3000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(50);
  });

  it("old timestamps age out of the window", () => {
    const limiter = new SlidingWindowLimiter(2, 10_000);
    limiter.check("k", 0);
    limiter.check("k", 1000);
    expect(limiter.check("k", 11_000).allowed).toBe(true); // both aged out
  });

  it("keys are isolated", () => {
    const limiter = new SlidingWindowLimiter(1, 60_000);
    limiter.check("a", 0);
    expect(limiter.check("b", 0).allowed).toBe(true);
  });
});
