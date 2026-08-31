import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service.js";
import { CrmPipelineService } from "./pipeline.service.js";
import { EngagementService } from "./engagement.service.js";
import { CrmCommsService } from "./comms.service.js";
import { CrmAnalyticsService } from "./analytics.service.js";
import { CrmAssistService } from "./assist.service.js";
import { CrmConfigService } from "./config.service.js";
import { CrmDraftService } from "./draft.service.js";
import { LlmGateway } from "../ai/gateway.js";
import { CrmController } from "./crm.controller.js";

@Module({
  providers: [CrmService, CrmPipelineService, EngagementService, CrmCommsService, CrmAnalyticsService, CrmAssistService, CrmConfigService, CrmDraftService, LlmGateway],
  controllers: [CrmController],
  exports: [CrmService, CrmPipelineService, EngagementService, CrmCommsService, CrmAnalyticsService, CrmAssistService, CrmConfigService, CrmDraftService],
})
export class CrmModule {}
