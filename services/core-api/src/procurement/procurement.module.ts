import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { ProcurementService } from "./procurement.service.js";
import { ProcurementController } from "./procurement.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [ProcurementService],
  controllers: [ProcurementController],
  exports: [ProcurementService],
})
export class ProcurementModule {}
