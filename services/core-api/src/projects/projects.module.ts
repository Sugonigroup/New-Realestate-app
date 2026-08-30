import { Module } from "@nestjs/common";
import { ProjectsService } from "./projects.service.js";
import { ProcurementService } from "./procurement.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProcurementController } from "./procurement.controller.js";

@Module({
  providers: [ProjectsService, ProcurementService],
  controllers: [ProjectsController, ProcurementController],
  exports: [ProjectsService, ProcurementService],
})
export class ProjectsModule {}
