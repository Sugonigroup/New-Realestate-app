import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { HrService } from "./hr.service.js";
import { HrLifecycleService } from "./hr-lifecycle.service.js";
import { HrController } from "./hr.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [HrService, HrLifecycleService],
  controllers: [HrController],
  exports: [HrService, HrLifecycleService],
})
export class HrModule {}
