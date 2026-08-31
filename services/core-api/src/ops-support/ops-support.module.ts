import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { OpsSupportService } from "./ops-support.service.js";
import { OpsSupportController } from "./ops-support.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [OpsSupportService],
  controllers: [OpsSupportController],
  exports: [OpsSupportService],
})
export class OpsSupportModule {}
