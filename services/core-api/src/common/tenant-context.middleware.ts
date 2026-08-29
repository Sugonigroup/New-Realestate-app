import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { getRequestContext, runWithRequestContext, type RequestContext } from "./request-context.js";
import { verifyToken } from "./jwt.js";

/**
 * Resolves tenant/user from a **verified** bearer JWT (03 §1: tenant is derived
 * from the token, never the client). Invalid tokens are skipped here and surface
 * as 403 at the guard layer; the dev `X-Tenant` header path exists ONLY outside
 * production and is rejected under NODE_ENV=production.
 */
export async function resolveContext(
  authHeader: string | undefined,
  devTenantHeader: string | undefined,
  isProduction: boolean,
): Promise<RequestContext> {
  let tenantId: string | undefined;
  let userId: string | undefined;
  let roleCodes: string[] | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const claims = await verifyToken(authHeader.slice("Bearer ".length).trim(), "access");
      tenantId = claims.tenant;
      userId = claims.sub;
      roleCodes = claims.roles;
    } catch {
      // invalid/expired: fall through unauthenticated (guards answer 403)
    }
  }

  if (!tenantId && !isProduction && devTenantHeader) {
    tenantId = devTenantHeader;
    userId = userId ?? "dev-user";
    roleCodes = roleCodes ?? ["super_admin"];
  }

  return {
    correlationId: getRequestContext()?.correlationId ?? randomUUID(),
    tenantId,
    userId,
    roleCodes,
  };
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    void resolveContext(
      req.header("authorization"),
      req.header("x-tenant-id"),
      process.env.NODE_ENV === "production",
    ).then((ctx) => runWithRequestContext(ctx, () => next()));
  }
}
