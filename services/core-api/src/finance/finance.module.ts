import { Module } from "@nestjs/common";
import { FinanceService } from "./finance.service.js";
import { EscrowService } from "./escrow.service.js";
import { GlService } from "./gl.service.js";
import { ApService } from "./ap.service.js";
import { BankService } from "./bank.service.js";
import { AdjustmentNoteService } from "./adjustment-note.service.js";
import { AgingDunningService } from "./aging-dunning.service.js";
import { EInvoiceService } from "./einvoice.service.js";
import { FinanceController } from "./finance.controller.js";
import { GlController } from "./gl.controller.js";

@Module({
  providers: [
    FinanceService,
    EscrowService,
    GlService,
    ApService,
    BankService,
    AdjustmentNoteService,
    AgingDunningService,
    EInvoiceService,
  ],
  controllers: [FinanceController, GlController],
  exports: [
    FinanceService,
    EscrowService,
    GlService,
    ApService,
    BankService,
    AdjustmentNoteService,
    AgingDunningService,
    EInvoiceService,
  ],
})
export class FinanceModule {}
