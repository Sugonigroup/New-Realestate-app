import { beforeAll, describe, expect, it } from "vitest";
import { signToken } from "./jwt.js";
import { resolveContext } from "./tenant-context.middleware.js";

beforeAll(() => {
  process.env.APP_SECRET ??= "test-secret-0123456789abcdef";
});

describe("tenant context resolution (WP-0C/WP-0D)", () => {
  it("extracts tenant/user/roles from a verified bearer JWT", async () => {
    const token = await signToken({ sub: "u-1", tenant: "t-1", roles: ["sales_manager"] }, { type: "access", ttlSec: 60 });
    const ctx = await resolveContext(`Bearer ${token}`, undefined, false);
    expect(ctx).toMatchObject({ tenantId: "t-1", userId: "u-1", roleCodes: ["sales_manager"] });
  });

  it("unauthenticated context for invalid/garbage tokens", async () => {
    const ctx = await resolveContext("Bearer not.a.jwt", undefined, false);
    expect(ctx.tenantId).toBeUndefined();
    expect(await resolveContext(undefined, undefined, false)).toMatchObject({ tenantId: undefined });
  });

  it("dev X-Tenant header works outside production and is ignored in production", async () => {
    const dev = await resolveContext(undefined, "t-dev", false);
    expect(dev).toMatchObject({ tenantId: "t-dev", userId: "dev-user", roleCodes: ["super_admin"] });
    const prod = await resolveContext(undefined, "t-dev", true);
    expect(prod.tenantId).toBeUndefined();
  });
});
