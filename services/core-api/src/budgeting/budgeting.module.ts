import { Module } from "@nestjs/common";
import { BudgetingService } from "./budgeting.service.js";
import { BudgetingController } from "./budgeting.controller.js";

@Module({
  providers: [BudgetingService],
  controllers: [BudgetingController],
  exports: [BudgetingService],
})
export class BudgetingModule {}
