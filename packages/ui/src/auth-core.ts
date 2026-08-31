/**
 * Pure auth helpers — safe to import from BOTH server and client components.
 * Must stay free of React hooks and the "use client" directive.
 */

export interface AuthUser {
  userId: string;
  tenantId: string;
  roles: string[];
}

export function parseJwtClaims(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  try {
    const [, payload] = token.split(".");
    const json = JSON.parse(Buffer.from(payload!, "base64url").toString("utf8")) as {
      sub?: string;
      tenant?: string;
      roles?: string[];
    };
    if (!json.sub || !json.tenant) return null;
    return { userId: json.sub, tenantId: json.tenant, roles: json.roles ?? [] };
  } catch {
    return null;
  }
}
