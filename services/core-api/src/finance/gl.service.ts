import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * General Ledger service (P0, 05): journal creation → validation (debits=credits,
 * period open, account postable) → posting → reversal (linked reversal entries).
 * No hard deletion of posted transactions.
 */

export interface JournalLineInput {
  accountCode: string;
  debitPaise: bigint;
  creditPaise: bigint;
  costCenter?: string;
  description?: string;
}

export interface JournalInput {
  tenantId: string;
  voucherNo: string;
  type: "journal" | "sales" | "purchase" | "receipt" | "payment" | "contra";
  date: Date;
  narration?: string;
  lines: JournalLineInput[];
  createdBy: string;
}

@Injectable()
export class GlService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a draft journal — validates balance, account existence, period openness. */
  async createJournal(input: JournalInput): Promise<{ journalId: string; voucherNo: string }> {
    const debits = input.lines.reduce((s, l) => s + l.debitPaise, 0n);
    const credits = input.lines.reduce((s, l) => s + l.creditPaise, 0n);
    if (debits !== credits || debits === 0n) {
      throw new BadRequestException(
        `journal ${input.voucherNo} unbalanced: debits ₹${Money.fromPaise(debits).formatIndian()} vs credits ₹${Money.fromPaise(credits).formatIndian()}`,
      );
    }

    // account existence + postable check
    for (const line of input.lines) {
      const account = await this.prisma.account.findFirst({
        where: { tenantId: input.tenantId, code: line.accountCode },
      });
      if (!account) throw new NotFoundException(`account ${line.accountCode} not found`);
      if (!account.isPostable) throw new BadRequestException(`account ${line.accountCode} is a header — not postable`);
    }

    // period open check
    await this.assertPeriodOpen(input.tenantId, input.date);

    const journal = await this.prisma.journal.create({
      data: {
        tenantId: input.tenantId,
        voucherNo: input.voucherNo,
        type: input.type,
        date: input.date,
        narration: input.narration,
        status: "draft",
        lines: {
          create: input.lines.map((l) => ({
            accountCode: l.accountCode,
            debitPaise: l.debitPaise,
            creditPaise: l.creditPaise,
            costCenter: l.costCenter,
            description: l.description,
          })),
        },
      },
    });
    return { journalId: journal.id, voucherNo: journal.voucherNo };
  }

  /** Post a draft journal — validates period is still open. */
  async postJournal(tenantId: string, journalId: string, postedBy: string): Promise<unknown> {
    const journal = await this.prisma.journal.findFirst({ where: { id: journalId, tenantId } });
    if (!journal) throw new NotFoundException("journal not found");
    if (journal.status !== "draft" && journal.status !== "pending_approval") {
      throw new BadRequestException(`journal is ${journal.status} — cannot post`);
    }
    await this.assertPeriodOpen(tenantId, journal.date);
    const posted = await this.prisma.journal.update({
      where: { id: journalId },
      data: { status: "posted", postedBy, postedAt: new Date() },
      include: { lines: true },
    });
    await this.audit(tenantId, postedBy, "gl.journal.posted", journalId, { voucherNo: posted.voucherNo });
    return posted;
  }

  /** Reverse a posted journal — creates a linked reversal, never deletes. */
  async reverseJournal(tenantId: string, journalId: string, reversedBy: string, reason: string): Promise<unknown> {
    const original = await this.prisma.journal.findFirst({
      where: { id: journalId, tenantId },
      include: { lines: true },
    });
    if (!original) throw new NotFoundException("journal not found");
    if (original.status !== "posted") throw new BadRequestException(`journal is ${original.status} — only posted journals can be reversed`);

    await this.assertPeriodOpen(tenantId, original.date);
    const reversalVoucherNo = `${original.voucherNo}-REV`;
    const reversal = await this.prisma.journal.create({
      data: {
        tenantId,
        voucherNo: reversalVoucherNo,
        type: original.type,
        date: new Date(),
        narration: `Reversal of ${original.voucherNo}: ${reason}`,
        status: "posted",
        postedBy: reversedBy,
        postedAt: new Date(),
        reversalOf: original.id,
        lines: {
          create: original.lines.map((l) => ({
            accountCode: l.accountCode,
            debitPaise: l.creditPaise, // swap
            creditPaise: l.debitPaise,
            costCenter: l.costCenter,
            description: `Reversal: ${l.description ?? ""}`,
          })),
        },
      },
    });
    await this.prisma.journal.update({
      where: { id: original.id },
      data: { status: "reversed", reversedBy },
    });
    await this.audit(tenantId, reversedBy, "gl.journal.reversed", reversal.id, {
      original: original.voucherNo,
      reversal: reversalVoucherNo,
      reason,
    });
    return reversal;
  }

  /** Trial balance: account code → net debit/credit from posted journals. */
  async trialBalance(tenantId: string, asOf: Date): Promise<Array<{ accountCode: string; debitPaise: bigint; creditPaise: bigint }>> {
    const journals = await this.prisma.journal.findMany({
      where: { tenantId, status: "posted", date: { lte: asOf } },
      include: { lines: true },
    });
    const tb = new Map<string, { debitPaise: bigint; creditPaise: bigint }>();
    for (const j of journals) {
      for (const line of j.lines) {
        const cur = tb.get(line.accountCode) ?? { debitPaise: 0n, creditPaise: 0n };
        cur.debitPaise += line.debitPaise;
        cur.creditPaise += line.creditPaise;
        tb.set(line.accountCode, cur);
      }
    }
    return [...tb.entries()]
      .map(([accountCode, v]) => ({ accountCode, ...v }))
      .sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  }

  /** Period lock. */
  async assertPeriodOpen(tenantId: string, date: Date): Promise<void> {
    const periodStr = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { tenantId_period: { tenantId, period: periodStr } },
    });
    if (period && period.status !== "open") {
      throw new BadRequestException(`fiscal period ${periodStr} is ${period.status} — transaction rejected`);
    }
  }

  private async audit(tenantId: string, userId: string, action: string, entityId: string, detail: Record<string, unknown>): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        tenantId, actorUserId: userId, actorKind: "human", action,
        entityType: "gl_journal", entityId, after: detail as object,
      },
    });
  }
}