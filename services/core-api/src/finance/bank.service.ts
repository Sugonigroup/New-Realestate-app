import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/** Bank reconciliation service (P0): statement import + matching. */
@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

  async importTransactions(tenantId: string, bankAccountId: string, transactions: Array<{
    date: Date; amountPaise: bigint; narration: string; utr?: string;
  }>): Promise<number> {
    let count = 0;
    for (const t of transactions) {
      try {
        await this.prisma.bankTransaction.create({
          data: { tenantId, bankAccountId, date: t.date, amountPaise: t.amountPaise, narration: t.narration, utr: t.utr },
        });
        count += 1;
      } catch { /* duplicate UTR — skip */ }
    }
    return count;
  }

  /** Auto-match bank transactions against cleared receipts by amount + UTR. */
  async autoMatch(tenantId: string, bankAccountId: string): Promise<{ matched: number }> {
    const unmatched = await this.prisma.bankTransaction.findMany({
      where: { tenantId, bankAccountId, matched: false },
    });
    let matched = 0;
    for (const bt of unmatched) {
      const candidates = await this.prisma.receipt.findMany({
        where: { tenantId, status: "cleared", instrumentRef: { not: null } },
        take: 20,
      });
      const match = candidates.find((r) =>
        r.instrumentRef === bt.utr || BigInt(r.amountPaise) === (bt.amountPaise < 0n ? -bt.amountPaise : bt.amountPaise),
      );
      if (match) {
        await this.prisma.bankTransaction.update({
          where: { id: bt.id },
          data: { matched: true, matchedType: "receipt", matchedId: match.id },
        });
        matched += 1;
      }
    }
    return { matched };
  }
}
