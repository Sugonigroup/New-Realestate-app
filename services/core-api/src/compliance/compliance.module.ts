import { Module } from "@nestjs/common";
import { ComplianceService } from "./compliance.service.js";
import { ComplianceController } from "./compliance.controller.js";

@Module({ providers: [ComplianceService], controllers: [ComplianceController], exports: [ComplianceService] })
export class ComplianceModule {}
