import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { SubcontractorService } from "./subcontractor.service.js";
import { QualityService } from "./quality.service.js";
import { HseService } from "./hse.service.js";
import { InventoryService } from "./inventory.service.js";
import { SiteOpsController } from "./siteops.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [SubcontractorService, QualityService, HseService, InventoryService],
  controllers: [SiteOpsController],
  exports: [SubcontractorService, QualityService, HseService, InventoryService],
})
export class SiteOpsModule {}
