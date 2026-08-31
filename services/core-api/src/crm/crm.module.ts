import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { CrmService } from "./crm.service.js";
import { CrmPipelineService } from "./pipeline.service.js";
import { EngagementService } from "./engagement.service.js";
import { CrmCommsService } from "./comms.service.js";
import { CrmAnalyticsService } from "./analytics.service.js";
import { CrmAssistService } from "./assist.service.js";
import { CrmConfigService } from "./config.service.js";
import { CrmDraftService } from "./draft.service.js";
import { CrmLifecycleService } from "./lifecycle.service.js";
import { LlmGateway } from "../ai/gateway.js";
import { CrmController } from "./crm.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [CrmService, CrmPipelineService, EngagementService, CrmCommsService, CrmAnalyticsService, CrmAssistService, CrmConfigService, CrmDraftService, CrmLifecycleService, LlmGateway],
  controllers: [CrmController],
  exports: [CrmService, CrmPipelineService, EngagementService, CrmCommsService, CrmAnalyticsService, CrmAssistService, CrmConfigService, CrmDraftService, CrmLifecycleService],
})
export class CrmModule {}
