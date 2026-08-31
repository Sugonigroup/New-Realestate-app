import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service.js";
import { CrmPipelineService } from "./pipeline.service.js";
import { EngagementService } from "./engagement.service.js";
import { CrmCommsService } from "./comms.service.js";
import { CrmAnalyticsService } from "./analytics.service.js";
import { CrmController } from "./crm.controller.js";

@Module({
  providers: [CrmService, CrmPipelineService, EngagementService, CrmCommsService, CrmAnalyticsService],
  controllers: [CrmController],
  exports: [CrmService, CrmPipelineService, EngagementService, CrmCommsService, CrmAnalyticsService],
})
export class CrmModule {}
