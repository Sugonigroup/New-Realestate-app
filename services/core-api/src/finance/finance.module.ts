import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service.js";
import { EscrowService } from "./escrow.service.js";
import { FinanceController } from "./finance.controller.js";

@Module({
  providers: [FinanceService, EscrowService],
  controllers: [FinanceController],
  exports: [FinanceService, EscrowService],
})
export class FinanceModule {}
