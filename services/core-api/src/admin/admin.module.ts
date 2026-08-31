import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { AdminController } from "./admin.controller.js";
import { PlatformController } from "./platform.controller.js";
import { MetricsService } from "../analytics/metrics.service.js";

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [AdminController, PlatformController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class AdminModule {}
