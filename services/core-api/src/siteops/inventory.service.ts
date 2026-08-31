import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

/**
 * Inventory & Warehouse depth service (INV-01):
 * - Immutable stock ledger: grn_in, issue, transfer, adjustment, return movements
 * - Weighted Average Cost (WAC) valuation — cost recomputed on every receipt:
 *     newWac = (stockQty * wac + inQty * inUnitCost) / (stockQty + inQty)
 * - Issues and outbound movements valued at current WAC
 * - Cycle counts with variance % and adjustment posting
 * - Reorder report: coverage days vs safety days + inbound PO quantities
 */

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private num(v: unknown): number {
    return Number(v);
  }

  /** GRN receipt: increments stock at received unit cost, recomputes WAC. */
  async receiveStock(tenantId: string, input: {
    projectId: string;
    materialId: string;
    materialName: string;
    unit: string;
    qty: number;
    unitCostPaise: bigint;
    refDocNo: string;
  }) {
    if (input.qty <= 0) throw new BadRequestException("receipt qty must be > 0");
    const stock = await this.prisma.materialStock.findFirst({
      where: { tenantId, projectId: input.projectId, materialId: input.materialId },
    });

    let newQty: number;
    let newWac: bigint;

    if (stock) {
      const curQty = this.num(stock.stockQty);
      const curWac = stock.wacPaise ?? 0n;
      newQty = curQty + input.qty;
      newWac =
        (BigInt(Math.round(curQty)) * curWac + BigInt(Math.round(input.qty)) * input.unitCostPaise) /
        BigInt(Math.round(newQty));
    } else {
      newQty = input.qty;
      newWac = input.unitCostPaise;
    }

    if (stock) {
      await this.prisma.materialStock.update({
        where: { id: stock.id },
        data: { stockQty: newQty, wacPaise: newWac },
      });
    } else {
      await this.prisma.materialStock.create({
        data: {
          tenantId,
          projectId: input.projectId,
          materialId: input.materialId,
          materialName: input.materialName,
          unit: input.unit,
          stockQty: newQty,
          wacPaise: newWac,
          avgDailyConsumption: 0,
        },
      });
    }

    await this.prisma.stockLedger.create({      data: {
        tenantId,
        projectId: input.projectId,
        materialId: input.materialId,
        movementType: "grn_in",
        qty: input.qty,
        unitCostPaise: newWac,
        balanceAfter: newQty,
        refDocType: "grn",
        refDocNo: input.refDocNo,
        movedAt: new Date(),
      },
    });
    return { materialId: input.materialId, qtyAfter: newQty, wacPaise: newWac };
  }

  /** Issue stock to site consumption — valued at current WAC, qty validated. */
  async issueStock(tenantId: string, input: {
    projectId: string;
    materialId: string;
    qty: number;
    refDocNo: string;
  }) {
    if (input.qty <= 0) throw new BadRequestException("issue qty must be > 0");
    const stock = await this.prisma.materialStock.findFirst({
      where: { tenantId, projectId: input.projectId, materialId: input.materialId },
    });
    if (!stock) throw new NotFoundException(`no stock for material ${input.materialId} on this project`);
    const available = this.num(stock.stockQty);
    if (input.qty > available) {
      throw new BadRequestException(`insufficient stock: requested ${input.qty} > available ${available}`);
    }

    const newQty = available - input.qty;
    await this.prisma.materialStock.update({
      where: { id: stock.id },
      data: { stockQty: newQty },
    });

    await this.prisma.stockLedger.create({
      data: {
        tenantId,
        projectId: input.projectId,
        materialId: input.materialId,
        movementType: "issue",
        qty: -input.qty,
        unitCostPaise: stock.wacPaise,
        balanceAfter: newQty,
        refDocType: "issue_note",
        refDocNo: input.refDocNo,
        movedAt: new Date(),
      },
    });
    return { materialId: input.materialId, qtyAfter: newQty, valuedAtWacPaise: stock.wacPaise };
  }

  /** Transfer stock between project stores — out at source WAC, in at same cost. */
  async transferStock(tenantId: string, input: {
    fromProjectId: string;
    toProjectId: string;
    materialId: string;
    qty: number;
    refDocNo: string;
  }) {
    if (input.fromProjectId === input.toProjectId) {
      throw new BadRequestException("source and destination projects must differ");
    }
    const issued = await this.issueStock(tenantId, {
      projectId: input.fromProjectId,
      materialId: input.materialId,
      qty: input.qty,
      refDocNo: input.refDocNo,
    });

    const sourceStock = await this.prisma.materialStock.findFirst({
      where: { tenantId, projectId: input.fromProjectId, materialId: input.materialId },
    });

    await this.receiveStock(tenantId, {
      projectId: input.toProjectId,
      materialId: input.materialId,
      materialName: sourceStock?.materialName ?? input.materialId,
      unit: sourceStock?.unit ?? "nos",
      qty: input.qty,
      unitCostPaise: issued.valuedAtWacPaise,
      refDocNo: input.refDocNo,
    });

    return { transferredQty: input.qty, valuedAtWacPaise: issued.valuedAtWacPaise };
  }

  /** Cycle count: record counted qty, compute variance; adjust if approved. */
  async recordCycleCount(tenantId: string, input: {
    countNo: string;
    projectId: string;
    materialId: string;
    countedQty: number;
  }) {
    const stock = await this.prisma.materialStock.findFirst({
      where: { tenantId, projectId: input.projectId, materialId: input.materialId },
    });
    if (!stock) throw new NotFoundException(`no stock row for material ${input.materialId}`);
    const existing = await this.prisma.stockCount.findFirst({ where: { tenantId, countNo: input.countNo } });
    if (existing) throw new ConflictException(`count ${input.countNo} already recorded`);

    const systemQty = this.num(stock.stockQty);
    const varianceQty = input.countedQty - systemQty;
    const variancePct = systemQty > 0 ? Math.round((varianceQty / systemQty) * 10000) / 100 : 0;

    return this.prisma.stockCount.create({
      data: {
        tenantId,
        countNo: input.countNo,
        projectId: input.projectId,
        materialId: input.materialId,
        systemQty,
        countedQty: input.countedQty,
        varianceQty,
        variancePct,
        status: "pending",
      },
    });
  }

  /** Apply an approved cycle count adjustment to stock + ledger. */
  async applyCountAdjustment(tenantId: string, countNo: string, approverId: string) {
    const count = await this.prisma.stockCount.findFirst({ where: { tenantId, countNo } });
    if (!count) throw new NotFoundException(`count ${countNo} not found`);
    if (count.status !== "pending") throw new ConflictException(`count ${countNo} is already ${count.status}`);

    const stock = await this.prisma.materialStock.findFirst({
      where: { tenantId, projectId: count.projectId, materialId: count.materialId },
    });
    if (!stock) throw new NotFoundException("stock row missing for count");

    await this.prisma.materialStock.update({
      where: { id: stock.id },
      data: { stockQty: Number(count.countedQty) },
    });
    await this.prisma.stockLedger.create({
      data: {
        tenantId,
        projectId: count.projectId,
        materialId: count.materialId,
        movementType: "adjustment",
        qty: Number(count.varianceQty),
        unitCostPaise: stock.wacPaise,
        balanceAfter: Number(count.countedQty),
        refDocType: "count",
        refDocNo: count.countNo,
        movedAt: new Date(),
      },
    });
    return this.prisma.stockCount.update({
      where: { id: count.id },
      data: { status: "adjusted", adjustedBy: approverId, adjustedAt: new Date() },
    });
  }

  /** Reorder report: days of coverage vs safety requirement, including inbound PO qty. */
  async reorderReport(tenantId: string, projectId: string) {
    const rows = await this.prisma.materialStock.findMany({ where: { tenantId, projectId } });
    return rows
      .map((r) => {
        const stockQty = this.num(r.stockQty);
        const dailyUse = this.num(r.avgDailyConsumption);
        const reorderLevel = dailyUse * r.safetyDays;
        const coverageDays = dailyUse > 0 ? Math.floor(stockQty / dailyUse) : Infinity;
        const effectiveStock = stockQty + this.num(r.inboundPoQty);
        const alert =
          effectiveStock <= reorderLevel ? "REORDER_NOW" : coverageDays <= r.safetyDays + r.leadTimeDays ? "REORDER_SOON" : "OK";
        return {
          materialId: r.materialId,
          materialName: r.materialName,
          stockQty,
          coverageDays,
          reorderLevel,
          inboundPoQty: this.num(r.inboundPoQty),
          alert,
        };
      })
      .sort((a, b) => (a.coverageDays === Infinity ? 1 : b.coverageDays === Infinity ? -1 : a.coverageDays - b.coverageDays));
  }
}

