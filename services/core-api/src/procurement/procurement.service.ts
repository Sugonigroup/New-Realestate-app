import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Procurement chain (P1a): vendor → PR → approve → RFQ → quotes → comparison
 * → award (PO) → GRN → stock update + vendor rating.
 * State-machine guards: quotes only on open RFQs, GRN qty capped at PO balance,
 * receipts immutable once posted.
 */

export interface PrLineInput {
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;
  estRatePaise: bigint;
  remark?: string;
}

export interface QuoteLineInput {
  materialId: string;
  qty: number;
  ratePaise: bigint;
}

@Injectable()
export class ProcurementService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vendors ─────────────────────────────────────────────────────────────

  async createVendor(tenantId: string, input: { code: string; name: string; gstin?: string }) {
    const existing = await this.prisma.vendor.findFirst({ where: { tenantId, code: input.code } });
    if (existing) throw new ConflictException(`vendor code ${input.code} already exists`);
    return this.prisma.vendor.create({
      data: { tenantId, code: input.code, name: input.name, gstin: input.gstin },
    });
  }

  /** Vendor rating from GRN history: on-time delivery vs PO promised date + accepted qty %. */
  async vendorRating(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { tenantId, id: vendorId } });
    if (!vendor) throw new NotFoundException(`vendor ${vendorId} not found`);
    const grns = await this.prisma.grn.findMany({
      where: { tenantId, vendorId },
      include: { lines: true, order: true },
    });
    if (grns.length === 0) {
      return { vendorId, grnCount: 0, onTimePct: null, acceptancePct: null, score: null, band: "unrated" };
    }
    let onTime = 0;
    let totalQty = 0n;
    let acceptedQty = 0n;
    for (const grn of grns) {
      const promised = grn.order?.promisedDate;
      if (!promised || grn.receivedAt <= promised) onTime += 1;
      for (const line of grn.lines) {
        const qty = BigInt(line.qty.toFixed(0));
        const acc = BigInt(line.acceptedQty.toFixed(0));
        totalQty += qty;
        acceptedQty += acc;
      }
    }
    const onTimePct = Math.round((onTime / grns.length) * 100);
    const acceptancePct = totalQty > 0n ? Math.round(Number((acceptedQty * 10000n) / totalQty) / 100) : 100;
    const score = Math.round(onTimePct * 0.5 + acceptancePct * 0.5);
    const band = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D";
    return { vendorId, grnCount: grns.length, onTimePct, acceptancePct, score, band };
  }

  // ── Purchase Requisition ────────────────────────────────────────────────

  async createPr(tenantId: string, input: {
    reqNo: string;
    projectId: string;
    requestedBy: string;
    requiredBy?: Date;
    lines: PrLineInput[];
  }) {
    if (input.lines.length === 0) throw new BadRequestException("PR needs at least one line");
    const existing = await this.prisma.purchaseRequisition.findFirst({ where: { tenantId, reqNo: input.reqNo } });
    if (existing) throw new ConflictException(`PR ${input.reqNo} already exists`);
    const pr = await this.prisma.purchaseRequisition.create({
      data: {
        tenantId,
        reqNo: input.reqNo,
        projectId: input.projectId,
        requestedBy: input.requestedBy,
        requiredBy: input.requiredBy,
        lines: {
          create: input.lines.map((l) => ({
            tenantId,
            materialId: l.materialId,
            materialName: l.materialName,
            unit: l.unit,
            qty: l.qty,
            estRatePaise: l.estRatePaise,
            remark: l.remark,
          })),
        },
      },
      include: { lines: true },
    });
    return pr;
  }

  /** Approve a PR — maker (requestedBy) cannot be the checker (approver), SoD enforced. */
  async approvePr(tenantId: string, prId: string, approverId: string) {
    const pr = await this.prisma.purchaseRequisition.findFirst({ where: { tenantId, id: prId } });
    if (!pr) throw new NotFoundException(`PR ${prId} not found`);
    if (pr.status !== "draft") throw new ConflictException(`PR ${pr.reqNo} is ${pr.status}, not draft`);
    if (pr.requestedBy === approverId) {
      throw new BadRequestException(`maker-checker violation: ${approverId} raised and cannot approve their own PR ${pr.reqNo}`);
    }
    return this.prisma.purchaseRequisition.update({
      where: { id: pr.id },
      data: { status: "approved", approvedBy: approverId, approvedAt: new Date() },
    });
  }

  // ── RFQ ─────────────────────────────────────────────────────────────────

  /** Issue an RFQ against an approved PR — RFQ lines are copied from PR lines. */
  async createRfq(tenantId: string, input: { rfqNo: string; requisitionId: string; closesAt?: Date }) {
    const pr = await this.prisma.purchaseRequisition.findFirst({
      where: { tenantId, id: input.requisitionId },
      include: { lines: true },
    });
    if (!pr) throw new NotFoundException(`PR ${input.requisitionId} not found`);
    if (pr.status !== "approved") {
      throw new ConflictException(`PR ${pr.reqNo} is ${pr.status}; only approved PRs can be quoted`);
    }
    const existing = await this.prisma.rfq.findFirst({ where: { tenantId, rfqNo: input.rfqNo } });
    if (existing) throw new ConflictException(`RFQ ${input.rfqNo} already exists`);
    return this.prisma.rfq.create({
      data: {
        tenantId,
        rfqNo: input.rfqNo,
        requisitionId: input.requisitionId,
        closesAt: input.closesAt,
        lines: {
          create: pr.lines.map((l) => ({
            tenantId,
            materialId: l.materialId,
            materialName: l.materialName,
            unit: l.unit,
            qty: l.qty,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /** Record a vendor quote — per-line rates, total computed from lines. */
  async receiveQuote(tenantId: string, input: {
    rfqId: string;
    vendorId: string;
    deliveryDays: number;
    lines: QuoteLineInput[];
  }) {
    const rfq = await this.prisma.rfq.findFirst({ where: { tenantId, id: input.rfqId } });
    if (!rfq) throw new NotFoundException(`RFQ ${input.rfqId} not found`);
    if (rfq.status !== "open") throw new ConflictException(`RFQ ${rfq.rfqNo} is ${rfq.status}, not open`);
    if (rfq.closesAt && new Date() > rfq.closesAt) {
      throw new ConflictException(`RFQ ${rfq.rfqNo} closed at ${rfq.closesAt.toISOString()}`);
    }
    const vendor = await this.prisma.vendor.findFirst({ where: { tenantId, id: input.vendorId } });
    if (!vendor) throw new NotFoundException(`vendor ${input.vendorId} not found`);
    if (vendor.status !== "active") {
      throw new ConflictException(`vendor ${vendor.code} is ${vendor.status}; cannot quote`);
    }
    const rfqLines = await this.prisma.rfqLine.findMany({ where: { tenantId, rfqId: rfq.id } });
    const rfqMaterials = new Set(rfqLines.map((l) => l.materialId));
    for (const ql of input.lines) {
      if (!rfqMaterials.has(ql.materialId)) {
        throw new BadRequestException(`quote line material ${ql.materialId} is not on RFQ ${rfq.rfqNo}`);
      }
    }
    const totalPaise = input.lines.reduce((s, l) => s + l.ratePaise * BigInt(Math.round(l.qty)), 0n);
    return this.prisma.rfqQuote.create({
      data: {
        tenantId,
        rfqId: rfq.id,
        vendorId: input.vendorId,
        deliveryDays: input.deliveryDays,
        totalPaise,
        lines: {
          create: input.lines.map((l) => ({
            tenantId,
            materialId: l.materialId,
            qty: l.qty,
            ratePaise: l.ratePaise,
          })),
        },
      },
      include: { lines: true },
    });
  }

  /** L1/L2 comparison: rank quotes by total, tie-break by delivery days; savings vs highest quote. */
  async compareQuotes(tenantId: string, rfqId: string) {
    const rfq = await this.prisma.rfq.findFirst({ where: { tenantId, id: rfqId } });
    if (!rfq) throw new NotFoundException(`RFQ ${rfqId} not found`);
    const quotes = await this.prisma.rfqQuote.findMany({ where: { tenantId, rfqId: rfq.id } });
    if (quotes.length === 0) throw new NotFoundException(`RFQ ${rfq.rfqNo} has no quotes yet`);
    const ranked = [...quotes].sort((a, b) => {
      if (a.totalPaise !== b.totalPaise) return a.totalPaise < b.totalPaise ? -1 : 1;
      return a.deliveryDays - b.deliveryDays;
    });
    const highest = ranked[ranked.length - 1]!.totalPaise;
    return {
      rfqId: rfq.id,
      rfqNo: rfq.rfqNo,
      quotes: ranked.map((q, i) => ({
        rank: i + 1,
        quoteId: q.id,
        vendorId: q.vendorId,
        totalPaise: q.totalPaise,
        deliveryDays: q.deliveryDays,
        savingsVsHighestPaise: highest - q.totalPaise,
      })),
    };
  }

  /** Award: accept a quote → PO with lines from the quote. RFQ + sibling quotes closed out. */
  async awardQuote(tenantId: string, input: {
    rfqId: string;
    quoteId: string;
    poNo: string;
    projectId: string;
    promisedDate?: Date;
  }) {
    const rfq = await this.prisma.rfq.findFirst({ where: { tenantId, id: input.rfqId } });
    if (!rfq) throw new NotFoundException(`RFQ ${input.rfqId} not found`);
    if (rfq.status !== "open") throw new ConflictException(`RFQ ${rfq.rfqNo} is ${rfq.status}; already decided`);
    const quote = await this.prisma.rfqQuote.findFirst({ where: { tenantId, id: input.quoteId, rfqId: rfq.id } });
    if (!quote) throw new NotFoundException(`quote ${input.quoteId} not found on RFQ ${rfq.rfqNo}`);
    if (quote.status !== "received") throw new ConflictException(`quote ${input.quoteId} is ${quote.status}`);
    const existingPo = await this.prisma.purchaseOrder.findFirst({ where: { tenantId, poNo: input.poNo } });
    if (existingPo) throw new ConflictException(`PO ${input.poNo} already exists`);
    const quoteLines = await this.prisma.rfqQuoteLine.findMany({ where: { tenantId, quoteId: quote.id } });
    const rfqLines = await this.prisma.rfqLine.findMany({ where: { tenantId, rfqId: rfq.id } });
    const lineMeta = new Map(rfqLines.map((l) => [l.materialId, l]));
    const po = await this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        projectId: input.projectId,
        vendorId: quote.vendorId,
        poNo: input.poNo,
        status: "open",
        totalPaise: quote.totalPaise,
        promisedDate: input.promisedDate,
        lines: {
          create: quoteLines.map((ql) => ({
            tenantId,
            materialId: ql.materialId,
            materialName: lineMeta.get(ql.materialId)?.materialName ?? ql.materialId,
            unit: lineMeta.get(ql.materialId)?.unit ?? "nos",
            qty: ql.qty,
            ratePaise: ql.ratePaise,
          })),
        },
      },
      include: { lines: true },
    });
    await this.prisma.rfqQuote.update({ where: { id: quote.id }, data: { status: "accepted" } });
    await this.prisma.rfqQuote.updateMany({
      where: { tenantId, rfqId: rfq.id, id: { not: quote.id }, status: "received" },
      data: { status: "rejected" },
    });
    await this.prisma.rfq.update({ where: { id: rfq.id }, data: { status: "awarded" } });
    await this.prisma.purchaseRequisition.update({
      where: { id: rfq.requisitionId },
      data: { status: "converted" },
    });
    return po;
  }

  // ── GRN ─────────────────────────────────────────────────────────────────

  /** Goods receipt: per-line accepted/rejected, capped at PO balance; updates stock + PO progress. */
  async receiveGrn(tenantId: string, input: {
    grnNo: string;
    orderId: string;
    projectId: string;
    receivedAt: Date;
    lines: Array<{ poLineId: string; qty: number; acceptedQty: number; rejectedQty?: number; remark?: string }>;
  }) {
    if (input.lines.length === 0) throw new BadRequestException("GRN needs at least one line");
    const existingGrn = await this.prisma.grn.findFirst({ where: { tenantId, grnNo: input.grnNo } });
    if (existingGrn) throw new ConflictException(`GRN ${input.grnNo} already exists`);
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { tenantId, id: input.orderId },
      include: { lines: true },
    });
    if (!po) throw new NotFoundException(`PO ${input.orderId} not found`);
    if (po.status === "cancelled") throw new ConflictException(`PO ${po.poNo} is cancelled`);
    const poLinesById = new Map(po.lines.map((l) => [l.id, l]));
    for (const gl of input.lines) {
      const poLine = poLinesById.get(gl.poLineId);
      if (!poLine) throw new BadRequestException(`GRN line poLineId ${gl.poLineId} is not a line of PO ${po.poNo}`);
      const outstanding = Number(poLine.qty) - Number(poLine.receivedQty);
      if (gl.qty > outstanding) {
        throw new BadRequestException(
          `over-receipt on ${poLine.materialName}: received ${gl.qty} > outstanding ${outstanding}`,
        );
      }
      if (gl.acceptedQty > gl.qty) {
        throw new BadRequestException(`accepted ${gl.acceptedQty} cannot exceed received ${gl.qty} for ${poLine.materialName}`);
      }
      const rejected = gl.rejectedQty ?? gl.qty - gl.acceptedQty;
      if (gl.acceptedQty + rejected !== gl.qty) {
        throw new BadRequestException(`accepted + rejected must equal received for ${poLine.materialName}`);
      }
    }
    const grn = await this.prisma.grn.create({
      data: {
        tenantId,
        grnNo: input.grnNo,
        orderId: po.id,
        projectId: input.projectId,
        vendorId: po.vendorId!,
        receivedAt: input.receivedAt,
        lines: {
          create: input.lines.map((gl) => ({
            tenantId,
            poLineId: gl.poLineId,
            materialId: poLinesById.get(gl.poLineId)!.materialId,
            qty: gl.qty,
            acceptedQty: gl.acceptedQty,
            rejectedQty: gl.rejectedQty ?? gl.qty - gl.acceptedQty,
            remark: gl.remark,
          })),
        },
      },
      include: { lines: true },
    });
    // Update PO line received quantities and material stock.
    for (const gl of input.lines) {
      const poLine = poLinesById.get(gl.poLineId)!;
      await this.prisma.purchaseOrderLine.update({
        where: { id: poLine.id },
        data: { receivedQty: Number(poLine.receivedQty) + gl.qty },
      });
      await this.prisma.materialStock.upsert({
        where: { tenantId_projectId_materialId: { tenantId, projectId: input.projectId, materialId: poLine.materialId } },
        create: {
          tenantId,
          projectId: input.projectId,
          materialId: poLine.materialId,
          materialName: poLine.materialName,
          unit: poLine.unit,
          stockQty: gl.acceptedQty,
          avgDailyConsumption: 0,
        },
        update: { stockQty: { increment: gl.acceptedQty } },
      });
    }
    const refreshed = await this.prisma.purchaseOrderLine.findMany({ where: { tenantId, orderId: po.id } });
    const complete = refreshed.every((l) => Number(l.receivedQty) >= Number(l.qty));
    await this.prisma.purchaseOrder.update({
      where: { id: po.id },
      data: { status: complete ? "received" : "partial", receivedInFull: complete, receivedDate: complete ? input.receivedAt : null },
    });
    return grn;
  }

  async listVendors(tenantId: string) {
    return this.prisma.vendor.findMany({ where: { tenantId }, orderBy: { code: "asc" }, take: 200 });
  }

  async listPrs(tenantId: string, status?: string) {
    return this.prisma.purchaseRequisition.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async listRfqs(tenantId: string, status?: string) {
    return this.prisma.rfq.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      include: { lines: true, quotes: { include: { lines: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async getRfq(tenantId: string, id: string) {
    const rfq = await this.prisma.rfq.findFirst({
      where: { id, tenantId },
      include: { lines: true, quotes: { include: { lines: true } } },
    });
    if (!rfq) throw new NotFoundException(`RFQ ${id} not found`);
    return rfq;
  }

  async listOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  async listGrns(tenantId: string) {
    return this.prisma.grn.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { receivedAt: "desc" },
      take: 200,
    });
  }

  async dashboard(tenantId: string) {
    const [prs, rfqs, orders, grns, raBills] = await Promise.all([
      this.listPrs(tenantId),
      this.listRfqs(tenantId),
      this.listOrders(tenantId),
      this.listGrns(tenantId),
      this.prisma.raBill.findMany({ where: { tenantId }, take: 200 }),
    ]);
    const raWithAnomalies = raBills.filter((b) => {
      const a = b.anomalies as unknown;
      return Array.isArray(a) && a.length > 0;
    }).length;
    return {
      kpis: {
        draftPrCount: prs.filter((p) => p.status === "draft").length,
        openRfqCount: rfqs.filter((r) => r.status === "open").length,
        openPoCount: orders.filter((o) => o.status === "open" || o.status === "partial").length,
        grnCount: grns.length,
        raAnomalyCount: raWithAnomalies,
      },
    };
  }
}
