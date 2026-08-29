import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { getRequestContext, runWithRequestContext, type RequestContext } from "./request-context.js";

interface JwtPayloadLike {
  sub?: string;
  tenant?: string;
  roles?: string[];
}

/**
 * Resolves tenant/user from the bearer token's payload.
 *
 * WP-0D will replace the unsigned decode with a verified JWT (RS256, JWKS) — the
 * `X-Tenant` header path exists ONLY for local development and is rejected when
 * NODE_ENV=production (`03 §1`: tenant is derived from the token, never the client).
 */
export function resolveTenantFromToken(authHeader: string | undefined): JwtPayloadLike | undefined {
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  const token = authHeader.slice("Bearer ".length).trim();
  const parts = token.split(".");
  if (parts.length !== 3) return undefined; // not a JWT-shaped token
  try {
    return JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as JwtPayloadLike;
  } catch {
    return undefined;
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const base = getRequestContext();
    const payload = resolveTenantFromToken(req.header("authorization"));
    let tenantId = payload?.tenant;
    let userId = payload?.sub;
    let roleCodes = payload?.roles;

    if (!tenantId && process.env.NODE_ENV !== "production") {
      const devHeader = req.header("x-tenant-id");
      if (devHeader) {
        tenantId = devHeader;
        userId = userId ?? "dev-user";
        roleCodes = roleCodes ?? ["super_admin"];
      }
    }

    const ctx: RequestContext = {
      correlationId: base?.correlationId ?? randomUUID(),
      tenantId,
      userId,
      roleCodes,
    };
    runWithRequestContext(ctx, () => next());
  }
}
