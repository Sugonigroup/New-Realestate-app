import { Module } from "@nestjs/common";
import { BudgetingService } from "./budgeting.service.js";
import { BudgetingController } from "./budgeting.controller.js";
import { TreasuryService } from "./treasury.service.js";
import { TreasuryController } from "./treasury.controller.js";

@Module({
  providers: [BudgetingService, TreasuryService],
  controllers: [BudgetingController, TreasuryController],
  exports: [BudgetingService, TreasuryService],
})
export class BudgetingModule {}
