import { describe, expect, it } from "vitest";
import { PermissionsService } from "./permissions.service.js";

describe("PermissionsService.require (WP-0D smoke)", () => {
  const svc = new PermissionsService();

  it("throws Forbidden for an unauthenticated context", () => {
    expect(() => svc.require("crm.lead.read")).toThrow();
  });
});
