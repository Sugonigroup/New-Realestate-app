import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "./index.js";

function client(
  getToken = () => "tok-1",
  refresh: () => Promise<string | null> = async () => null,
) {
  return new ApiClient({ baseUrl: "https://api", getToken, refresh });
}

const okJson = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("ApiClient (U0)", () => {
  it("attaches the bearer token and parses JSON", async () => {
    const fetchMock = vi.fn(async () => okJson({ hello: "world" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await client().get<{ hello: string }>("/v1/things");
    expect(out.hello).toBe("world");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api/v1/things");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tok-1");
  });

  it("parses RFC-7807 problem+json into ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ title: "Forbidden", status: 403, errors: ["out-of-scope"] }), {
        status: 403,
        headers: { "content-type": "application/problem+json" },
      }),
    ));
    const err = (await client().get("/v1/x").catch((e) => e as ApiError)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.problem.errors).toEqual(["out-of-scope"]);
  });

  it("refreshes once on 401 and retries with the new token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(okJson({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    let refreshed = 0;
    const c = client(() => "old", async () => { refreshed += 1; return "new"; });
    const out = await c.get<{ ok: boolean }>("/v1/x");
    expect(out.ok).toBe(true);
    expect(refreshed).toBe(1);
    const secondInit = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1];
    expect((secondInit.headers as Record<string, string>).authorization).toBe("Bearer new");
  });

  it("does not retry twice", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const c = client(() => "old", async () => "new");
    await expect(c.get("/v1/x")).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
