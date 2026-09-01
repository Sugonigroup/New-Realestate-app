import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { getRequestContext } from "../common/request-context.js";
import { ROLE_MAP } from "@buildos/permissions";

/** Admin (U4): audit viewer + role matrix (read-only view; edits are API-level). */
@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get("audit")
  async audit(@Query("action") action?: string): Promise<unknown> {
    await this.permissions.requireAsync("audit.read");
    const ctx = getRequestContext();
    return this.prisma.auditEvent.findMany({
      where: { tenantId: ctx!.tenantId!, ...(action ? { action: { contains: action } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Get("users")
  async users(): Promise<unknown> {
    await this.permissions.requireAsync("audit.read");
    const ctx = getRequestContext();
    return this.prisma.user.findMany({
      where: { tenantId: ctx!.tenantId!, deletedAt: null },
      select: { id: true, email: true, fullName: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  @Get("roles")
  async roles(): Promise<unknown> {
    await this.permissions.requireAsync("audit.read");
    return [...ROLE_MAP.values()].map((r) => ({
      code: r.code,
      name: r.name,
      external: !!r.external,
      grants: r.permissions,
      denied: r.denied ?? [],
    }));
  }
}
