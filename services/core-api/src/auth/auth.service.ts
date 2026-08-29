import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  ACCESS_TTL_SEC,
  REFRESH_TTL_SEC,
  verifyToken,
  signToken,
  TokenError,
} from "../common/jwt.js";
import { verifyPassword } from "./password.js";
import { verifyTotp } from "./totp.js";
import { LoginLockout } from "./lockout.js";

const MFA_REQUIRED_ROLES = new Set(["cfo", "finance_manager", "md", "super_admin", "compliance_head", "hr_manager"]);

@Injectable()
export class AuthService {
  private readonly lockout = new LoginLockout();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Password login; TOTP step-up when enrolled, and roles that handle money or
   * compliance must have MFA enrolled before they can sign in (01 FR-1.3).
   */
  async login(
    tenantSlug: string,
    email: string,
    password: string,
    mfaCode?: string,
  ): Promise<{ accessToken: string; refreshToken: string } | { mfaRequired: true }> {
    const userKey = `${tenantSlug}:${email}`;
    if (this.lockout.isLocked(userKey)) {
      throw new UnauthorizedException({ title: "Account temporarily locked", errors: ["too many failed attempts"] });
    }

    const user = await this.prisma.user.findFirst({
      where: { email, status: "active", deletedAt: null, tenant: { slug: tenantSlug } },
      include: { roles: true },
    });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      this.lockout.recordFailure(userKey);
      throw new UnauthorizedException({ title: "Invalid credentials" });
    }

    const roleCodes = await this.rolesOf(user.tenantId, user.roles.map((r) => r.roleId));
    const mfaMandatory = roleCodes.some((r) => MFA_REQUIRED_ROLES.has(r));
    if (user.mfaSecret) {
      if (!mfaCode || !verifyTotp(user.mfaSecret, mfaCode, Date.now())) {
        throw new UnauthorizedException({ title: "Invalid MFA code" });
      }
    } else if (mfaMandatory || mfaCode !== undefined) {
      throw new UnauthorizedException({
        title: "MFA enrolment required",
        errors: mfaMandatory ? ["MFA is mandatory for this role"] : ["MFA code provided but not enrolled"],
      });
    }

    this.lockout.clear(userKey);
    const session = await this.prisma.session.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      },
    });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return this.issueTokens({ sub: user.id, tenant: user.tenantId, roles: roleCodes, sid: session.id });
  }

  /** Refresh rotation: verifies refresh token + live session, issues new pair. */
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let claims;
    try {
      claims = await verifyToken(refreshToken, "refresh");
    } catch (e) {
      throw new UnauthorizedException({ title: "Invalid refresh token", errors: [(e as TokenError).reason] });
    }
    if (claims.sid) {
      const session = await this.prisma.session.findUnique({ where: { id: claims.sid } });
      if (!session || session.revokedAt || session.expiresAt < new Date()) {
        throw new UnauthorizedException({ title: "Session revoked or expired" });
      }
    }
    return this.issueTokens({
      sub: claims.sub,
      tenant: claims.tenant,
      roles: claims.roles,
      sid: claims.sid,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const claims = await verifyToken(refreshToken, "refresh");
      if (claims.sid) {
        await this.prisma.session.update({
          where: { id: claims.sid },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // logout is best-effort; an invalid token is already "logged out"
    }
  }

  private async issueTokens(base: { sub: string; tenant: string; roles: string[]; sid?: string }) {
    const [accessToken, refreshToken] = await Promise.all([
      signToken(base, { type: "access", ttlSec: ACCESS_TTL_SEC }),
      signToken(base, { type: "refresh", ttlSec: REFRESH_TTL_SEC }),
    ]);
    return { accessToken, refreshToken };
  }

  private async rolesOf(tenantId: string, roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) return [];
    const roles = await this.prisma.role.findMany({
      where: { tenantId, id: { in: roleIds } },
      select: { code: true },
    });
    return roles.map((r) => r.code);
  }
}
