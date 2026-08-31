import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { ComplianceService } from "./compliance.service.js";
import { ReraComplianceService } from "./rera-compliance.service.js";
import { ComplianceController } from "./compliance.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [ComplianceService, ReraComplianceService],
  controllers: [ComplianceController],
  exports: [ComplianceService, ReraComplianceService],
})
export class ComplianceModule {}
