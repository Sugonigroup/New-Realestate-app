import { Module } from "@nestjs/common";
import { HrService } from "./hr.service.js";
import { HrLifecycleService } from "./hr-lifecycle.service.js";
import { HrController } from "./hr.controller.js";

@Module({
  providers: [HrService, HrLifecycleService],
  controllers: [HrController],
  exports: [HrService, HrLifecycleService],
})
export class HrModule {}
