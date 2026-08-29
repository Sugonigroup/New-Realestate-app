import { ForbiddenException, Injectable } from "@nestjs/common";
import { PermissionEngine, ROLE_MAP, type Decision, type ResourceContext } from "@buildos/permissions";
import { getRequestContext } from "../common/request-context.js";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Bridges the @buildos/permissions engine into Nest: resolves the caller's
 * UserContext from the request context and evaluates permission + scope.
 * DataScopes load from user_roles; role templates power the seed and defaults.
 */
@Injectable()
export class PermissionsService {
  private readonly engine = new PermissionEngine(ROLE_MAP);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Caller context with REAL DataScopes from user_roles (03 §2.1). Falls back to
   * ALL only for the dev header path (no user row); never for JWT callers.
   */
  async currentContextAsync() {
    const ctx = getRequestContext();
    if (!ctx?.tenantId || !ctx.userId) {
      throw new ForbiddenException({ title: "Unauthenticated", errors: ["missing tenant/user context"] });
    }
    if (ctx.userId === "dev-user") {
      return { userId: ctx.userId, roles: ctx.roleCodes ?? [], scopes: [{ level: "ALL" as const }] };
    }
    const rows = await this.prisma.userRole.findMany({ where: { tenantId: ctx.tenantId, userId: ctx.userId } });
    const scopes = rows.map((r) => ({
      level: r.scope as "ALL" | "ENTITY" | "PROJECT" | "OWN",
      refs: r.scopeRefs,
    }));
    return { userId: ctx.userId, roles: ctx.roleCodes ?? [], scopes };
  }

  currentContext() {
    const ctx = getRequestContext();
    if (!ctx?.tenantId || !ctx.userId) {
      throw new ForbiddenException({ title: "Unauthenticated", errors: ["missing tenant/user context"] });
    }
    return {
      userId: ctx.userId,
      roles: ctx.roleCodes ?? [],
      scopes: [{ level: "ALL" as const }], // legacy sync path (health/dev); async used by guards
    };
  }

  /** Full evaluation with DB-backed scopes. */
  async evaluateAsync(permission: string, resource?: ResourceContext): Promise<Decision> {
    return this.engine.evaluate(await this.currentContextAsync(), permission, resource);
  }

  evaluate(permission: string, resource?: ResourceContext): Decision {
    return this.engine.evaluate(this.currentContext(), permission, resource);
  }

  /** Guard helper (async, scope-aware): throws 403 (problem+json) on failure. */
  async requireAsync(permission: string, resource?: { projectId?: string }): Promise<Decision> {
    const resourceCtx = resource?.projectId ? { projectId: resource.projectId } : undefined;
    const d = await this.evaluateAsync(permission, resourceCtx);
    if (!d.allowed) {
      throw new ForbiddenException({ title: "Forbidden", errors: [`${permission}: ${d.reason}`] });
    }
    return d;
  }

  /** Guard helper: throws 403 (problem+json) when the check fails. */
  require(permission: string, resource?: ResourceContext): Decision {
    const d = this.evaluate(permission, resource);
    if (!d.allowed) {
      throw new ForbiddenException({ title: "Forbidden", errors: [`${permission}: ${d.reason}`] });
    }
    return d;
  }
}
