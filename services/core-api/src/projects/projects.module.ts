import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { ProjectsService } from "./projects.service.js";
import { ProcurementService } from "./procurement.service.js";
import { ProjectsController } from "./projects.controller.js";
import { ProcurementController } from "./procurement.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [ProjectsService, ProcurementService],
  controllers: [ProjectsController, ProcurementController],
  exports: [ProjectsService, ProcurementService],
})
export class ProjectsModule {}
