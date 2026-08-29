import { describe, expect, it } from "vitest";
import { resolveTenantFromToken } from "./tenant-context.middleware.js";

function jwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

describe("tenant context resolution (WP-0C)", () => {
  it("extracts tenant/user/roles from a bearer JWT payload", () => {
    const token = jwt({ sub: "u-1", tenant: "t-1", roles: ["sales_manager"] });
    const out = resolveTenantFromToken(`Bearer ${token}`);
    expect(out).toEqual({ sub: "u-1", tenant: "t-1", roles: ["sales_manager"] });
  });

  it("returns undefined for non-JWT or garbage input", () => {
    expect(resolveTenantFromToken(undefined)).toBeUndefined();
    expect(resolveTenantFromToken("Bearer abc")).toBeUndefined();
    expect(resolveTenantFromToken("Bearer a.@@@.c")).toBeUndefined();
  });
});
