import { beforeAll, describe, expect, it } from "vitest";
import { TokenError, signToken, verifyToken, ACCESS_TTL_SEC } from "./jwt.js";

beforeAll(() => {
  process.env.APP_SECRET = "test-secret-0123456789abcdef";
});

describe("verified JWT layer (WP-0D-lite)", () => {
  const base = { sub: "u-1", tenant: "t-1", roles: ["sales_manager"] };

  it("round-trips access tokens", async () => {
    const token = await signToken(base, { type: "access", ttlSec: ACCESS_TTL_SEC });
    const claims = await verifyToken(token, "access");
    expect(claims).toMatchObject({ sub: "u-1", tenant: "t-1", roles: ["sales_manager"], typ: "access" });
  });

  it("rejects a refresh token where an access token is required", async () => {
    const refresh = await signToken(base, { type: "refresh", ttlSec: 60 });
    await expect(verifyToken(refresh, "access")).rejects.toMatchObject({ reason: "wrong-type" });
  });

  it("rejects tampered payloads", async () => {
    const token = await signToken(base, { type: "access", ttlSec: 60 });
    const [h, , s] = token.split(".");
    const forged = `${h}.${Buffer.from(JSON.stringify({ ...base, roles: ["md"] })).toString("base64url")}.${s}`;
    await expect(verifyToken(forged, "access")).rejects.toBeInstanceOf(TokenError);
  });

  it("rejects expired tokens with a distinct reason", async () => {
    const token = await signToken(base, { type: "access", ttlSec: -1 });
    await expect(verifyToken(token, "access")).rejects.toMatchObject({ reason: "expired" });
  });

  it("refuses to sign without APP_SECRET", async () => {
    const saved = process.env.APP_SECRET;
    delete process.env.APP_SECRET;
    await expect(signToken(base, { type: "access", ttlSec: 60 })).rejects.toThrow(/APP_SECRET/);
    process.env.APP_SECRET = saved;
  });
});
