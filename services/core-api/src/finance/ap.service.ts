import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";

/** AP service (P0): vendor invoice 3-way match (PO + GRN + Invoice) + payment proposal. */
@Injectable()
export class ApService {
  constructor(private readonly prisma: PrismaService) {}

  /** Vendor invoice with 3-way match: PO total vs GRN vs invoice amount. */
  async matchInvoice(tenantId: string, input: {
    invoiceNo: string;
    vendorId: string;
    projectId?: string;
    invoiceAmountPaise: bigint;
    poTotalPaise: bigint;
    grnTotalPaise: bigint;
    tdsBps: number;
  }): Promise<{ matchResult: object; status: string; tdsPaise: bigint; invoiceId: string }> {
    const variance = Number(input.invoiceAmountPaise - input.poTotalPaise);
    const variancePct = input.poTotalPaise > 0n ? Math.round((variance * 10_000) / Number(input.poTotalPaise)) / 100 : 0;

    const grnMatch = input.grnTotalPaise === input.poTotalPaise;
    const invoiceMatch = Math.abs(variancePct) <= 5; // 5% tolerance
    const status = invoiceMatch && grnMatch ? "3way_matched" : invoiceMatch ? "2way_matched" : "rejected";

    const matchResult = {
      poTotal: Money.fromPaise(input.poTotalPaise).formatIndian(),
      grnTotal: Money.fromPaise(input.grnTotalPaise).formatIndian(),
      invoiceTotal: Money.fromPaise(input.invoiceAmountPaise).formatIndian(),
      variancePct,
      grnMatch,
      invoiceMatch,
    };

    const tdsPaise = (input.invoiceAmountPaise * BigInt(input.tdsBps)) / 10_000n;
    const invoice = await this.prisma.vendorInvoice.create({
      data: {
        tenantId,
        vendorId: input.vendorId,
        projectId: input.projectId,
        invoiceNo: input.invoiceNo,
        invoiceDate: new Date(),
        amountPaise: input.invoiceAmountPaise,
        gstAmountPaise: 0n,
        tdsBps: input.tdsBps,
        status,
        matchResult: matchResult as object,
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId, actorKind: "human", action: "gl.ap.matched",
        entityType: "vendor_invoice", entityId: invoice.id,
        after: { invoiceNo: input.invoiceNo, status, variancePct } as object,
      },
    });
    return { matchResult, status, tdsPaise, invoiceId: invoice.id };
  }

  /** Payment proposal: approved invoices above threshold → payment run. */
  async paymentProposal(tenantId: string, minAmountPaise: bigint): Promise<unknown> {
    const invoices = await this.prisma.vendorInvoice.findMany({
      where: { tenantId, status: "3way_matched", amountPaise: { gte: minAmountPaise } },
      orderBy: { invoiceDate: "asc" },
    });
    const totalPaise = invoices.reduce((s, i) => s + i.amountPaise, 0n);
    return { proposals: invoices.map((i) => ({ invoiceId: i.id, vendorId: i.vendorId, amountPaise: i.amountPaise.toString() })), totalPaise: totalPaise.toString() };
  }

  async listInvoices(tenantId: string, status?: string) {
    return this.prisma.vendorInvoice.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { invoiceDate: "desc" },
      take: 200,
    });
  }
}
