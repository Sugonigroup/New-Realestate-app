import { Module } from "@nestjs/common";
import { SubcontractorService } from "./subcontractor.service.js";
import { QualityService } from "./quality.service.js";
import { HseService } from "./hse.service.js";
import { SiteOpsController } from "./siteops.controller.js";

@Module({
  providers: [SubcontractorService, QualityService, HseService],
  controllers: [SiteOpsController],
  exports: [SubcontractorService, QualityService, HseService],
})
export class SiteOpsModule {}
