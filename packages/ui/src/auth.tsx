"use client";

import { createContext, useContext, useMemo } from "react";
import { ROLE_MAP, permissionMatches } from "@buildos/permissions";
import type { AuthUser } from "./auth-core.js";

/**
 * Auth context (U0): role claims from the (server-verified) session token drive
 * UI visibility only — every action is still enforced by the API (03 §2).
 */

export { parseJwtClaims } from "./auth-core.js";
export type { AuthUser } from "./auth-core.js";

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
