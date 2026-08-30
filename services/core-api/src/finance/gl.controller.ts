import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { getRequestContext } from "../common/request-context.js";
import { PermissionsService } from "../permissions/permissions.service.js";
import { GlService } from "./gl.service.js";
import { ApService } from "./ap.service.js";
import { BankService } from "./bank.service.js";

const journalDto = z.object({
  voucherNo: z.string().min(1),
  type: z.enum(["journal", "sales", "purchase", "receipt", "payment", "contra"]),
  date: z.string().datetime(),
  narration: z.string().optional(),
  lines: z.array(z.object({
    accountCode: z.string().min(1),
    debitPaise: z.string().regex(/^\d+$/),
    creditPaise: z.string().regex(/^\d+$/),
    costCenter: z.string().optional(),
    description: z.string().optional(),
  })).min(2),
});

const matchDto = z.object({
  invoiceNo: z.string().min(1),
  vendorId: z.string().min(1),
  projectId: z.string().uuid().optional(),
  invoiceAmountPaise: z.string().regex(/^\d+$/),
  poTotalPaise: z.string().regex(/^\d+$/),
  grnTotalPaise: z.string().regex(/^\d+$/),
  tdsBps: z.number().int().min(0),
});

const bankImportDto = z.object({
  bankAccountId: z.string().uuid(),
  transactions: z.array(z.object({
    date: z.string().datetime(),
    amountPaise: z.string(),
    narration: z.string().min(1),
    utr: z.string().optional(),
  })),
});

@ApiTags("gl")
@Controller("gl")
export class GlController {
  constructor(
    private readonly gl: GlService,
    private readonly ap: ApService,
    private readonly bank: BankService,
    private readonly permissions: PermissionsService,
  ) {}

  @Post("journals")
  async createJournal(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create"); // finance module
    const dto = journalDto.parse(body);
    const ctx = getRequestContext();
    return this.gl.createJournal({
      tenantId: ctx!.tenantId!,
      voucherNo: dto.voucherNo,
      type: dto.type,
      date: new Date(dto.date),
      narration: dto.narration,
      createdBy: ctx!.userId!,
      lines: dto.lines.map((l) => ({
        accountCode: l.accountCode,
        debitPaise: BigInt(l.debitPaise),
        creditPaise: BigInt(l.creditPaise),
        costCenter: l.costCenter,
        description: l.description,
      })),
    });
  }

  @Post("journals/:id/post")
  async post(@Param("id") id: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create");
    const ctx = getRequestContext();
    return this.gl.postJournal(ctx!.tenantId!, id, ctx!.userId!);
  }

  @Post("journals/:id/reverse")
  async reverse(@Param("id") id: string, @Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create");
    const { reason } = z.object({ reason: z.string().min(1) }).parse(body);
    const ctx = getRequestContext();
    return this.gl.reverseJournal(ctx!.tenantId!, id, ctx!.userId!, reason);
  }

  @Get("trial-balance")
  async trialBalance(@Query("asOf") asOf?: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.read");
    const ctx = getRequestContext();
    return this.gl.trialBalance(ctx!.tenantId!, asOf ? new Date(asOf) : new Date());
  }

  @Post("ap/invoices/match")
  async matchInvoice(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.receipt.create");
    const dto = matchDto.parse(body);
    const ctx = getRequestContext();
    return this.ap.matchInvoice(ctx!.tenantId!, {
      invoiceNo: dto.invoiceNo,
      vendorId: dto.vendorId,
      projectId: dto.projectId,
      invoiceAmountPaise: BigInt(dto.invoiceAmountPaise),
      poTotalPaise: BigInt(dto.poTotalPaise),
      grnTotalPaise: BigInt(dto.grnTotalPaise),
      tdsBps: dto.tdsBps,
    });
  }

  @Get("ap/payment-proposal")
  async paymentProposal(@Query("minPaise") minPaise?: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.read");
    const ctx = getRequestContext();
    return this.ap.paymentProposal(ctx!.tenantId!, BigInt(minPaise ?? "0"));
  }

  @Post("bank/transactions/import")
  async importBank(@Body() body: unknown): Promise<unknown> {
    await this.permissions.requireAsync("finance.recon.create");
    const dto = bankImportDto.parse(body);
    const ctx = getRequestContext();
    return {
      imported: await this.bank.importTransactions(
        ctx!.tenantId!, dto.bankAccountId,
        dto.transactions.map((t) => ({ date: new Date(t.date), amountPaise: BigInt(t.amountPaise), narration: t.narration, utr: t.utr })),
      ),
    };
  }

  @Post("bank/auto-match")
  async autoMatch(@Query("bankAccountId") bankAccountId: string): Promise<unknown> {
    await this.permissions.requireAsync("finance.recon.create");
    const ctx = getRequestContext();
    return this.bank.autoMatch(ctx!.tenantId!, bankAccountId);
  }
}
