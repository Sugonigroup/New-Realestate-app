import { ForbiddenException, Injectable } from "@nestjs/common";
import { PermissionEngine, ROLE_MAP, type Decision, type ResourceContext } from "@buildos/permissions";
import { getRequestContext } from "../common/request-context.js";

/**
 * Bridges the @buildos/permissions engine into Nest: resolves the caller's
 * UserContext from the request context and evaluates permission + scope.
 * WP-0D adds DB-backed role bindings; templates power the seed and defaults.
 */
@Injectable()
export class PermissionsService {
  private readonly engine = new PermissionEngine(ROLE_MAP);

  currentContext() {
    const ctx = getRequestContext();
    if (!ctx?.tenantId || !ctx.userId) {
      throw new ForbiddenException({ title: "Unauthenticated", errors: ["missing tenant/user context"] });
    }
    return {
      userId: ctx.userId,
      roles: ctx.roleCodes ?? [],
      scopes: [{ level: "ALL" as const }], // WP-0D: load real DataScopes from user_roles
    };
  }

  evaluate(permission: string, resource?: ResourceContext): Decision {
    return this.engine.evaluate(this.currentContext(), permission, resource);
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
