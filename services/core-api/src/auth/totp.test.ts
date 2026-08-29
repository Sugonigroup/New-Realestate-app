import { describe, expect, it } from "vitest";
import { base32Decode, generateTotpSecret, totp, verifyTotp } from "./totp.js";
import { LoginLockout } from "./lockout.js";

describe("TOTP (RFC 6238 test vectors)", () => {
  // RFC 6238 Appendix B secret "12345678901234567890" (ASCII) in base32
  const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  it("matches RFC vectors (8-digit reference → 6-digit suffix semantics)", () => {
    // T=59 → 94287082 (8 digits) → 6-digit: 287082
    expect(totp(SECRET, 59_000, 30, 8)).toBe("94287082");
    // T=1111111109 → 07081804
    expect(totp(SECRET, 1111111109_000, 30, 8)).toBe("07081804");
    // T=1234567890 → 89005924
    expect(totp(SECRET, 1234567890_000, 30, 8)).toBe("89005924");
  });

  it("verifies with ±1 step skew and rejects wrong codes", () => {
    const now = 59_000;
    expect(verifyTotp(SECRET, totp(SECRET, now), now)).toBe(true);
    expect(verifyTotp(SECRET, totp(SECRET, now + 30_000), now)).toBe(true); // next step
    expect(verifyTotp(SECRET, "000000", now)).toBe(false);
  });

  it("base32 decodes RFC vectors and rejects invalid characters", () => {
    // 8 base32 chars = 40 bits = 5 bytes: "12345" (prefix of the RFC secret "1234567890…")
    expect(base32Decode("GEZDGNBV").toString()).toBe("12345");
    expect(() => base32Decode("GEZD1NBV")).toThrow(TypeError);
  });

  it("generates decodable enrolment secrets", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]+$/);
    expect(base32Decode(s)).toHaveLength(20);
  });
});

describe("login lockout (03 §5)", () => {
  it("locks after 5 failures within the window and clears on success", () => {
    const lock = new LoginLockout();
    const key = "tenant:admin@x";
    for (let i = 0; i < 4; i++) lock.recordFailure(key);
    expect(lock.isLocked(key)).toBe(false);
    lock.recordFailure(key);
    expect(lock.isLocked(key)).toBe(true);

    lock.clear(key);
    expect(lock.isLocked(key)).toBe(false);
  });

  it("old failures age out of the window", () => {
    const lock = new LoginLockout();
    const key = "tenant:old@x";
    const t0 = Date.now() - 11 * 60_000;
    for (let i = 0; i < 5; i++) lock.recordFailure(key, t0);
    expect(lock.isLocked(key)).toBe(false);
  });

  it("per-user isolation", () => {
    const lock = new LoginLockout();
    for (let i = 0; i < 5; i++) lock.recordFailure("a@x");
    expect(lock.isLocked("b@x")).toBe(false);
  });
});
