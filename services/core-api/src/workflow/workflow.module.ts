import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { WorkflowService } from "./workflow.service.js";
import { WorkflowController } from "./workflow.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [WorkflowService],
  controllers: [WorkflowController],
  exports: [WorkflowService],
})
export class WorkflowModule {}
