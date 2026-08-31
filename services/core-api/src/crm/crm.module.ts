import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service.js";
import { CrmPipelineService } from "./pipeline.service.js";
import { EngagementService } from "./engagement.service.js";
import { CrmController } from "./crm.controller.js";

@Module({
  providers: [CrmService, CrmPipelineService, EngagementService],
  controllers: [CrmController],
  exports: [CrmService, CrmPipelineService, EngagementService],
})
export class CrmModule {}
