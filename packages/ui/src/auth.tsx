"use client";

import { createContext, useContext, useMemo } from "react";
import { ROLE_MAP, permissionMatches } from "@buildos/permissions";

/**
 * Auth context (U0): role claims from the (server-verified) session token drive
 * UI visibility only — every action is still enforced by the API (03 §2).
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

const AuthCtx = createContext<AuthUser | null>(null);

export function AuthProvider({ user, children }: { user: AuthUser | null; children: React.ReactNode }) {
  return <AuthCtx.Provider value={user}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthUser | null {
  return useContext(AuthCtx);
}

/** Module-level nav visibility: any grant in the module's permission space. */
export function useCan(module: string): boolean {
  const user = useAuth();
  return useMemo(() => {
    if (!user) return false;
    const grants = user.roles.flatMap((r) => ROLE_MAP.get(r)?.permissions ?? []);
    return grants.some((g) => g === "**" || g.startsWith("**.") || g.split(".")[0] === module);
  }, [user, module]);
}
