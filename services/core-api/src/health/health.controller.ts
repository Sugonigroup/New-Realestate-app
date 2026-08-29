import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Deep health: process + DB reachability. Never leaks internals. */
  @Get()
  async check(): Promise<{ status: "ok" | "degraded"; uptimeSec: number; checks: Record<string, string> }> {
    let db = "ok";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "unreachable";
    }
    const status = db === "ok" ? "ok" : "degraded";
    return { status, uptimeSec: Math.round(process.uptime()), checks: { db } };
  }
}
