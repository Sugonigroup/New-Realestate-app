import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { GlService } from "./gl.service.js";

/**
 * Debit & Credit Notes service (FIN-02):
 * - Supplier & Customer Debit/Credit Note generation with GST calculation
 * - Automated posting to General Ledger with proper debits/credits
 * - Audit-safe linking to reference invoice number
 */

@Injectable()
export class AdjustmentNoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gl: GlService,
  ) {}

  async issueNote(tenantId: string, input: {
    noteNo: string;
    type: "customer_credit" | "customer_debit" | "supplier_credit" | "supplier_debit";
    partyId: string;
    refInvoiceNo: string;
    amountPaise: bigint;
    gstRateBps?: number; // e.g. 1800 for 18% GST or 500 for 5% GST
    reason: "rate_difference" | "quantity_shortage" | "quality_discount" | "cancellation" | "other";
    createdBy: string;
  }) {
    if (input.amountPaise <= 0n) throw new BadRequestException("amountPaise must be > 0");
    const existing = await this.prisma.creditDebitNote.findFirst({ where: { tenantId, noteNo: input.noteNo } });
    if (existing) throw new ConflictException(`note ${input.noteNo} already exists`);

    const gstBps = BigInt(input.gstRateBps ?? 1800);
    const gstPaise = (input.amountPaise * gstBps) / 10_000n;
    const totalPaise = input.amountPaise + gstPaise;

    // Post corresponding balanced GL entry based on note type
    let journalVoucherNo = `JV-${input.noteNo}`;
    let debitsAccount = "1100-AR";
    let creditsAccount = "4000-REV";

    if (input.type === "customer_credit") {
      debitsAccount = "4000-REV";
      creditsAccount = "1100-AR";
    } else if (input.type === "supplier_debit") {
      debitsAccount = "2100-AP";
      creditsAccount = "5000-EXP";
    } else if (input.type === "supplier_credit") {
      debitsAccount = "5000-EXP";
      creditsAccount = "2100-AP";
    }

    const journal = await this.gl.createJournal({
      tenantId,
      voucherNo: journalVoucherNo,
      type: "journal",
      date: new Date(),
      narration: `${input.type.replace("_", " ").toUpperCase()} Note ${input.noteNo} for ${input.refInvoiceNo}: ${input.reason}`,
      createdBy: input.createdBy,
      lines: [
        { accountCode: debitsAccount, debitPaise: totalPaise, creditPaise: 0n, description: `${input.type} note debits` },
        { accountCode: creditsAccount, debitPaise: 0n, creditPaise: totalPaise, description: `${input.type} note credits` },
      ],
    });

    await this.gl.postJournal(tenantId, journal.journalId, input.createdBy);

    return this.prisma.creditDebitNote.create({
      data: {
        tenantId,
        noteNo: input.noteNo,
        type: input.type,
        partyId: input.partyId,
        refInvoiceNo: input.refInvoiceNo,
        amountPaise: input.amountPaise,
        gstPaise,
        totalPaise,
        reason: input.reason,
        glJournalId: journal.journalId,
        status: "posted",
      },
    });
  }
}
