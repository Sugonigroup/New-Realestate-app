import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { LandService } from "./land.service.js";
import { LandController } from "./land.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [LandService],
  controllers: [LandController],
  exports: [LandService],
})
export class LandModule {}
