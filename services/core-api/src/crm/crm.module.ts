import { Module } from "@nestjs/common";
import { CrmService } from "./crm.service.js";
import { CrmController } from "./crm.controller.js";

@Module({
  providers: [CrmService],
  controllers: [CrmController],
  exports: [CrmService],
})
export class CrmModule {}
