/**
 * RBAC + ABAC model — mirrors `03-backend-architecture.md §2` and compiles from the
 * same source of truth intended for `permissions.yaml` (Phase 0 WP-0D).
 * Permission string: `context.resource.action[.qualifier...]` with wildcard segments.
 *   '*'  matches exactly one segment
 *   '**' matches one or more trailing segments
 * Deny always wins. DataScope narrows rows (ALL | ENTITY | PROJECT | OWN).
 */

export interface ParsedPermission {
  segments: string[];
}

/** Lenient parse for granted wildcard patterns (`**`, `sales.*`, `**.read` are legal). */
export function parsePattern(p: string): ParsedPermission {
  const segments = p.split(".").map((s) => s.trim());
  if (segments.some((s) => s.length === 0)) {
    throw new TypeError(`permission pattern has empty segment: "${p}"`);
  }
  return { segments };
}

/** Strict parse for required permissions: ≥3 concrete segments (context.resource.action). */
export function parsePermission(p: string): ParsedPermission {
  const { segments } = parsePattern(p);
  if (segments.length < 3) {
    throw new TypeError(`permission must have ≥3 segments (context.resource.action): "${p}"`);
  }
  return { segments };
}

/**
 * Match semantics:
 *   '*'            — exactly one segment; as the FINAL grant segment it matches 1+ trailing
 *                    segments (module-wide grants, e.g. `sales.*` ⊇ `sales.booking.create`)
 *   '**'           — zero or more segments anywhere (e.g. `**.read` = any read action)
 * Required permissions are concrete (no wildcards).
 */
export function permissionMatches(granted: string, required: string): boolean {
  return matchFrom(parsePattern(granted).segments, 0, parsePattern(required).segments, 0);
}

function matchFrom(g: string[], gi: number, r: string[], ri: number): boolean {
  if (gi === g.length) return ri === r.length;
  const gs = g[gi]!;
  if (gs === "**") {
    for (let j = ri; j <= r.length; j++) {
      if (matchFrom(g, gi + 1, r, j)) return true;
    }
    return false;
  }
  if (ri >= r.length) return false;
  if (gs === "*") {
    if (gi === g.length - 1) return true; // trailing: 1+ remaining segments
    return matchFrom(g, gi + 1, r, ri + 1); // middle: exactly one
  }
  return gs === r[ri] && matchFrom(g, gi + 1, r, ri + 1);
}

export type ScopeLevel = "ALL" | "ENTITY" | "PROJECT" | "OWN";

export interface DataScope {
  level: ScopeLevel;
  /** project ids (PROJECT), entity ids (ENTITY); OWN uses ownerId match */
  refs?: string[];
}

export interface UserContext {
  userId: string;
  roles: string[]; // role codes
  scopes: DataScope[];
}

export interface ResourceContext {
  projectId?: string;
  entityId?: string;
  ownerId?: string;
}

export type DecisionReason =
  | "granted"
  | "wildcard-granted"
  | "no-permission"
  | "denied"
  | "out-of-scope"
  | "unknown-role";

export interface Decision {
  allowed: boolean;
  reason: DecisionReason;
  matchedBy?: string; // role/permission that granted
}

export interface Role {
  code: string;
  name: string;
  permissions: string[];
  denied?: string[];
  external?: boolean;
}

export class PermissionEngine {
  constructor(private readonly roles: Map<string, Role>) {}

  private roleOf(code: string): Role | undefined {
    return this.roles.get(code);
  }

  /** Permission check only (no scope) — used for UI gating and tests. */
  hasPermission(ctx: UserContext, required: string): Decision {
    parsePermission(required); // strict validation of the requirement
    for (const roleCode of ctx.roles) {
      const role = this.roleOf(roleCode);
      if (!role) continue;
      for (const d of role.denied ?? []) {
        if (permissionMatches(d, required)) {
          return { allowed: false, reason: "denied", matchedBy: `${roleCode}:${d}` };
        }
      }
    }
    for (const roleCode of ctx.roles) {
      const role = this.roleOf(roleCode);
      if (!role) continue;
      for (const p of role.permissions) {
        if (permissionMatches(p, required)) {
          return { allowed: true, reason: p.includes("*") ? "wildcard-granted" : "granted", matchedBy: `${roleCode}:${p}` };
        }
      }
    }
    return { allowed: false, reason: "no-permission" };
  }

  /** Full check: permission AND data-scope match against the resource. */
  evaluate(ctx: UserContext, required: string, resource?: ResourceContext): Decision {
    const perm = this.hasPermission(ctx, required);
    if (!perm.allowed) return perm;
    if (!resource) return perm;
    if (!this.inScope(ctx, resource)) {
      return { allowed: false, reason: "out-of-scope", matchedBy: perm.matchedBy };
    }
    return perm;
  }

  inScope(ctx: UserContext, resource: ResourceContext): boolean {
    return ctx.scopes.some((s) => {
      switch (s.level) {
        case "ALL":
          return true;
        case "ENTITY":
          return !!resource.entityId && (s.refs ?? []).includes(resource.entityId);
        case "PROJECT":
          return !!resource.projectId && (s.refs ?? []).includes(resource.projectId);
        case "OWN":
          return !!resource.ownerId && resource.ownerId === ctx.userId;
        default: {
          const _exhaustive: never = s.level;
          return _exhaustive;
        }
      }
    });
  }

  assertKnownRoles(codes: string[]): void {
    const unknown = codes.filter((c) => !this.roles.has(c));
    if (unknown.length) throw new RangeError(`unknown roles: ${unknown.join(", ")}`);
  }
}
