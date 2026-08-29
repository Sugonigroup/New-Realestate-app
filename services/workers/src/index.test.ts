import { describe, expect, it } from "vitest";
import { WORKER_ENTRYPOINT } from "./index.js";

describe("workers entrypoint", () => {
  it("exports the worker identity", () => {
    expect(WORKER_ENTRYPOINT).toBe("buildos-workers");
  });
});
