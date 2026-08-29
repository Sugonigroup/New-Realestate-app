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

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /** Password login (MFA enforced at WP-0D for finance/admin roles — 01 FR-1.3). */
  async login(tenantSlug: string, email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email, tenant: { slug: tenantSlug }, status: "active", deletedAt: null },
      include: { roles: true },
    });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException({ title: "Invalid credentials" });
    }
    const roles = await this.rolesOf(user.tenantId, user.roles.map((r) => r.roleId));
    const session = await this.prisma.session.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      },
    });
    return this.issueTokens({
      sub: user.id,
      tenant: user.tenantId,
      roles,
      sid: session.id,
    });
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
