import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module.js";
import { ContractsService } from "./contracts.service.js";
import { ContractsController } from "./contracts.controller.js";

@Module({ imports: [PermissionsModule],
  providers: [ContractsService],
  controllers: [ContractsController],
  exports: [ContractsService],
})
export class ContractsModule {}
