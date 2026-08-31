import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { AssetsService } from "./assets.service.js";
import { AssetsController } from "./assets.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [AssetsService],
  controllers: [AssetsController],
  exports: [AssetsService],
})
export class AssetsModule {}
