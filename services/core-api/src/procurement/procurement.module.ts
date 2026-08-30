import { Module } from "@nestjs/common";
import { ProcurementService } from "./procurement.service.js";
import { ProcurementController } from "./procurement.controller.js";

@Module({
  providers: [ProcurementService],
  controllers: [ProcurementController],
  exports: [ProcurementService],
})
export class ProcurementModule {}
