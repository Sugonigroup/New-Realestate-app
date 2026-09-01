import { ApiClient } from "@buildos/api-client";

const CORE_API = process.env.CORE_API_URL ?? "http://localhost:8080";

/** Server-side client: RSC pages pass the cookie token explicitly. */
export function serverApi(token?: string): ApiClient {
  return new ApiClient({
    baseUrl: CORE_API,
    getToken: () => token ?? null,
    refresh: async () => null,
  });
}

/** Browser client: token from cookie, refresh posts to /v1/auth/refresh. */
export function browserApi(): ApiClient {
  const read = (k: string) => document.cookie.split("; ").find((c) => c.startsWith(k + "="))?.split("=")[1] ?? null;
  return new ApiClient({
    baseUrl: process.env.NEXT_PUBLIC_CORE_API ?? CORE_API,
    getToken: () => read("access_token"),
    refresh: async () => {
      const res = await fetch(`${CORE_API}/v1/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: read("refresh_token") }),
      });
      if (!res.ok) return null;
      const out = (await res.json()) as { accessToken: string };
      document.cookie = `access_token=${out.accessToken}; path=/; max-age=900; samesite=strict`;
      return out.accessToken;
    },
  });
}

/** Buyer portal: JWT in portal_access_token; no refresh (OTP re-login). */
export function portalBrowserApi(): ApiClient {
  const read = (k: string) => document.cookie.split("; ").find((c) => c.startsWith(k + "="))?.split("=")[1] ?? null;
  return new ApiClient({
    baseUrl: process.env.NEXT_PUBLIC_CORE_API ?? CORE_API,
    getToken: () => read("portal_access_token"),
    refresh: async () => null,
  });
}
