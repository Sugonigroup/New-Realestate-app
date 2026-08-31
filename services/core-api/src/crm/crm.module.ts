import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service.js";
import { CrmPipelineService } from "./pipeline.service.js";
import { CrmController } from "./crm.controller.js";

@Module({
  providers: [CrmService, CrmPipelineService],
  controllers: [CrmController],
  exports: [CrmService, CrmPipelineService],
})
export class CrmModule {}
