import type { PrismaClient } from "@prisma/client";

const TOTAL = 24_500_000_00n;
const QTY = 70_000;
const RATE_L1 = 35_000n;

/** Verde cement chain behind PO-0001. Idempotent. Does not call awardQuote (duplicate poNo). */
export async function seedProcurementChain(
  prisma: PrismaClient,
  tenantId: string,
  projectId: string,
  requestedBy: string,
): Promise<void> {
  const vendor = async (code: string, name: string, gstin: string) => {
    const existing = await prisma.vendor.findFirst({ where: { tenantId, code } });
    if (existing) return existing;
    return prisma.vendor.create({ data: { tenantId, code, name, gstin } });
  };
  const ultratech = await vendor("ultratech", "UltraTech Cement Ltd", "24AAACL6442L1ZS");
  const ramco = await vendor("ramco", "Ramco Cements", "33AAACR4747Q1Z1");
  const dalmia = await vendor("dalmia", "Dalmia Bharat", "10AABCD1234E1Z5");

  let pr = await prisma.purchaseRequisition.findFirst({ where: { tenantId, reqNo: "PR-0001" } });
  if (!pr) {
    pr = await prisma.purchaseRequisition.create({
      data: {
        tenantId, reqNo: "PR-0001", projectId, requestedBy,
        status: "converted", requiredBy: new Date("2026-08-01"),
        lines: {
          create: [{
            tenantId, materialId: "cement-opc53", materialName: "OPC 53 Cement",
            unit: "bag", qty: QTY, estRatePaise: RATE_L1,
          }],
        },
      },
    });
  }

  let rfq = await prisma.rfq.findFirst({ where: { tenantId, rfqNo: "RFQ-0001" } });
  if (!rfq) {
    rfq = await prisma.rfq.create({
      data: {
        tenantId, rfqNo: "RFQ-0001", requisitionId: pr.id, status: "awarded",
        closesAt: new Date("2026-07-20"),
        lines: {
          create: [{
            tenantId, materialId: "cement-opc53", materialName: "OPC 53 Cement",
            unit: "bag", qty: QTY,
          }],
        },
      },
    });
  }

  const quote = async (vendorId: string, rate: bigint, days: number, status: string) => {
    const existing = await prisma.rfqQuote.findFirst({ where: { tenantId, rfqId: rfq!.id, vendorId } });
    if (existing) return existing;
    return prisma.rfqQuote.create({
      data: {
        tenantId, rfqId: rfq!.id, vendorId, deliveryDays: days, status,
        totalPaise: BigInt(QTY) * rate,
        lines: { create: [{ tenantId, materialId: "cement-opc53", qty: QTY, ratePaise: rate }] },
      },
    });
  };
  await quote(ultratech.id, RATE_L1, 14, "accepted");
  await quote(ramco.id, 36_000n, 10, "rejected");
  await quote(dalmia.id, 37_000n, 7, "rejected");

  const po = await prisma.purchaseOrder.findFirst({
    where: { tenantId, poNo: "PO-0001" },
    include: { lines: true },
  });
  if (po) {
    if (!po.vendorId) {
      await prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { vendorId: ultratech.id, totalPaise: TOTAL, status: "received", receivedInFull: true },
      });
    }
    if (po.lines.length === 0) {
      await prisma.purchaseOrderLine.create({
        data: {
          tenantId, orderId: po.id, materialId: "cement-opc53", materialName: "OPC 53 Cement",
          unit: "bag", qty: QTY, ratePaise: RATE_L1, receivedQty: QTY,
        },
      });
    }
  }

  const poFresh = await prisma.purchaseOrder.findFirst({
    where: { tenantId, poNo: "PO-0001" },
    include: { lines: true },
  });
  if (poFresh && !(await prisma.grn.findFirst({ where: { tenantId, grnNo: "GRN-0001" } }))) {
    const line = poFresh.lines[0];
    await prisma.grn.create({
      data: {
        tenantId, grnNo: "GRN-0001", orderId: poFresh.id, projectId,
        vendorId: ultratech.id, status: "posted", receivedAt: new Date("2026-08-14"),
        lines: line ? {
          create: [{
            tenantId, poLineId: line.id, materialId: line.materialId,
            qty: QTY, acceptedQty: QTY, rejectedQty: 0,
          }],
        } : undefined,
      },
    });
  }
}
