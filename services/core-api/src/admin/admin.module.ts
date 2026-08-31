import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module.js";
import { AdminController } from "./admin.controller.js";
import { MetricsService } from "../analytics/metrics.service.js";

@Module({
  imports: [PrismaModule],
  controllers: [AdminController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class AdminModule {}
