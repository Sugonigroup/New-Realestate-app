import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ProcurementService } from "./procurement.service.js";

/**
 * Fake prisma with in-memory rows covering the whole chain:
 * vendor → PR → RFQ → quote → award (PO) → GRN → stock.
 */

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    vendors: [] as Row[],
    prs: [] as Row[],
    prLines: [] as Row[],
    rfqs: [] as Row[],
    rfqLines: [] as Row[],
    quotes: [] as Row[],
    quoteLines: [] as Row[],
    pos: [] as Row[],
    poLines: [] as Row[],
    grns: [] as Row[],
    grnLines: [] as Row[],
    stock: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function toRow(data: Row): Row {
    return { ...data };
  }

  // Real Prisma stamps the parent FK on nested creates automatically; the fake must too.
  const child = (parentId: string, fk: string, create: any[]) =>
    (create as any[]).map((l) => ({ id: nid("ln"), ...l, [fk]: parentId }));

  const prisma = {
    vendor: {
      findFirst: vi.fn(async ({ where }: any) => db.vendors.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.vendors.filter(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = toRow({ id: nid("v"), ...data }); db.vendors.push(r); return r; }),
    },
    purchaseRequisition: {
      findFirst: vi.fn(async ({ where }: any) => db.prs.find(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = toRow({ id: nid("pr"), status: "draft", ...data });
        r.lines = child(r.id, "requisitionId", data.lines.create);
        db.prLines.push(...(r.lines as Row[]));
        db.prs.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.prs.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
      findMany: vi.fn(async ({ where, include }: any) => {
        return db.prs.filter(match(where)).map((r) => ({
          ...r,
          lines: include?.lines ? db.prLines.filter((l) => l.requisitionId === r.id) : undefined,
        }));
      }),
    },
    rfq: {
      findFirst: vi.fn(async ({ where }: any) => db.rfqs.find(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = toRow({ id: nid("rfq"), status: "open", ...data });
        r.lines = child(r.id, "rfqId", data.lines.create);
        db.rfqLines.push(...(r.lines as Row[]));
        db.rfqs.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => { const r = db.rfqs.find((x) => x.id === where.id)!; Object.assign(r, data); return r; }),
      findMany: vi.fn(async ({ where, include }: any) => {
        return db.rfqs.filter(match(where)).map((r) => ({
          ...r,
          lines: include?.lines ? db.rfqLines.filter((l) => l.rfqId === r.id) : undefined,
        }));
      }),
    },
    rfqLine: { findMany: vi.fn(async ({ where }: any) => db.rfqLines.filter(match(where))) },
    rfqQuote: {
      findFirst: vi.fn(async ({ where }: any) => db.quotes.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.quotes.filter(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = toRow({ id: nid("q"), status: "received", ...data });
        r.lines = child(r.id, "quoteId", data.lines.create);
        db.quoteLines.push(...(r.lines as Row[]));
        db.quotes.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => { const r = db.quotes.find((x) => x.id === where.id)!; Object.assign(r, data); return r; }),
      updateMany: vi.fn(async ({ where, data }: any) => {
        let n = 0;
        for (const q of db.quotes) {
          if (where.tenantId === q.tenantId && where.rfqId === q.rfqId && q.id !== where.id.not && q.status === where.status) {
            Object.assign(q, data);
            n += 1;
          }
        }
        return { count: n };
      }),
    },
    rfqQuoteLine: { findMany: vi.fn(async ({ where }: any) => db.quoteLines.filter(match(where))) },
    purchaseOrder: {
      findFirst: vi.fn(async ({ where }: any) => db.pos.find(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = toRow({ id: nid("po"), status: "open", ...data });
        r.lines = child(r.id, "orderId", data.lines.create).map((l) => ({ receivedQty: 0, ...l }));
        db.poLines.push(...(r.lines as Row[]));
        db.pos.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => { const r = db.pos.find((x) => x.id === where.id)!; Object.assign(r, data); return r; }),
    },
    purchaseOrderLine: {
      update: vi.fn(async ({ where, data }: any) => { const r = db.poLines.find((x) => x.id === where.id)!; Object.assign(r, data); return r; }),
      findMany: vi.fn(async ({ where }: any) => db.poLines.filter(match(where))),
    },
    grn: {
      findFirst: vi.fn(async ({ where }: any) => db.grns.find(match(where))),
      findMany: vi.fn(async ({ where, include }: any) => {
        return db.grns.filter(match(where)).map((r) => ({
          ...r,
          lines: include?.lines ? db.grnLines.filter((l) => l.grnId === r.id) : undefined,
        }));
      }),
      create: vi.fn(async ({ data }: any) => {
        const r = toRow({ id: nid("grn"), status: "posted", ...data });
        r.order = db.pos.find((x) => x.id === data.orderId);
        r.lines = child(r.id, "grnId", data.lines.create);
        db.grnLines.push(...(r.lines as Row[]));
        db.grns.push(r);
        return r;
      }),
    },
    materialStock: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        let s = db.stock.find((x) => x.tenantId === where.tenantId_projectId_materialId.tenantId
          && x.projectId === where.tenantId_projectId_materialId.projectId
          && x.materialId === where.tenantId_projectId_materialId.materialId);
        if (!s) {
          const fresh = { id: nid("stk"), ...create };
          db.stock.push(fresh);
          return fresh;
        } else if ("stockQty" in update && typeof update.stockQty === "object") {
          s.stockQty = Number(s.stockQty) + update.stockQty.increment;
        } else {
          Object.assign(s, update);
        }
        return s;
      }),
    },
  };

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "not" in (v as object)) return row[k] !== (v as { not: unknown }).not;
      return row[k] === v;
    });
  }

  return { prisma, db };
}

const T = "t-1";
const PROJECT = "11111111-1111-1111-1111-111111111111";

async function seedChain(db: ReturnType<typeof fakePrisma>["db"]) {
  db.vendors.push({ id: "v-low", tenantId: T, code: "V1", name: "Low bidder", status: "active" });
  db.vendors.push({ id: "v-high", tenantId: T, code: "V2", name: "High bidder", status: "active" });
  db.prs.push({
    id: "pr-1", tenantId: T, reqNo: "PR-001", projectId: PROJECT, requestedBy: "user-maker",
    status: "approved", approvedBy: "user-checker", approvedAt: new Date(),
  });
  db.prLines.push({ id: "prl-1", tenantId: T, requisitionId: "pr-1", materialId: "M-CEM", materialName: "Cement OPC 53", unit: "bag", qty: 1000, estRatePaise: 38000n });
  db.rfqs.push({ id: "rfq-1", tenantId: T, rfqNo: "RFQ-001", requisitionId: "pr-1", status: "open" });
  db.rfqLines.push({ id: "rfl-1", tenantId: T, rfqId: "rfq-1", materialId: "M-CEM", materialName: "Cement OPC 53", unit: "bag", qty: 1000 });
}


describe("ProcurementService chain", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: ProcurementService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new ProcurementService(f.prisma as never);
  });

  it("rejects PR approval by the same user who raised it (maker-checker)", async () => {
    f.db.prs.push({ id: "pr-x", tenantId: T, reqNo: "PR-X", projectId: PROJECT, requestedBy: "user-1", status: "draft" });
    await expect(svc.approvePr(T, "pr-x", "user-1")).rejects.toThrow(BadRequestException);
  });

  it("blocks RFQ creation against an unapproved PR", async () => {
    f.db.prs.push({ id: "pr-draft", tenantId: T, reqNo: "PR-D", projectId: PROJECT, requestedBy: "u1", status: "draft" });
    await expect(svc.createRfq(T, { rfqNo: "RFQ-D", requisitionId: "pr-draft" })).rejects.toThrow(ConflictException);
  });

  it("computes quote totals from lines and ranks comparison lowest-first with tie-break on delivery", async () => {
    await seedChain(f.db);
    await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-high", deliveryDays: 3,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 40000n }],
    });
    await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 10,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    const cmp = await svc.compareQuotes(T, "rfq-1");
    expect(cmp.quotes[0]!.vendorId).toBe("v-low");
    expect(cmp.quotes[0]!.totalPaise).toBe(38_500_000n);
    expect(cmp.quotes[0]!.savingsVsHighestPaise).toBe(1_500_000n);
    expect(cmp.quotes[1]!.rank).toBe(2);
  });

  it("rejects a quote after the RFQ close date", async () => {
    await seedChain(f.db);
    f.db.rfqs[0]!.closesAt = new Date(Date.now() - 86_400_000);
    await expect(svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 5,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38000n }],
    })).rejects.toThrow(ConflictException);
  });

  it("rejects a quote for a material not on the RFQ", async () => {
    await seedChain(f.db);
    await expect(svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 5,
      lines: [{ materialId: "M-STEEL", qty: 10, ratePaise: 500000n }],
    })).rejects.toThrow(BadRequestException);
  });

  it("awards the winning quote: PO with lines, RFQ awarded, siblings rejected, PR converted", async () => {
    await seedChain(f.db);
    const qLow = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-high", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 40000n }],
    });
    const po = await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: qLow.id, poNo: "PO-001", projectId: PROJECT });
    expect(po.poNo).toBe("PO-001");
    expect(po.vendorId).toBe("v-low");
    expect(po.totalPaise).toBe(38_500_000n);
    expect(po.lines).toHaveLength(1);
    expect((po.lines as Row[])[0]!.materialName).toBe("Cement OPC 53");
    expect(f.db.rfqs[0]!.status).toBe("awarded");
    expect(f.db.prs[0]!.status).toBe("converted");
    const sibling = f.db.quotes.find((q) => q.vendorId === "v-high")!;
    expect(sibling.status).toBe("rejected");
  });

  it("cannot award the same RFQ twice", async () => {
    await seedChain(f.db);
    const q = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: q.id, poNo: "PO-001", projectId: PROJECT });
    const q2 = { id: "q-other", tenantId: T, rfqId: "rfq-1", vendorId: "v-high", totalPaise: 1n, deliveryDays: 1, status: "received" };
    f.db.quotes.push(q2);
    await expect(svc.awardQuote(T, { rfqId: "rfq-1", quoteId: "q-other", poNo: "PO-002", projectId: PROJECT }))
      .rejects.toThrow(ConflictException);
  });

  it("posts a GRN within PO balance, updates stock and marks PO received when complete", async () => {
    await seedChain(f.db);
    const q = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    const po = await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: q.id, poNo: "PO-001", projectId: PROJECT, promisedDate: new Date("2026-09-10") });
    const poLine = (po.lines as Row[])[0]!;
    const grn = await svc.receiveGrn(T, {
      grnNo: "GRN-001", orderId: po.id, projectId: PROJECT, receivedAt: new Date("2026-09-08"),
      lines: [{ poLineId: poLine.id, qty: 1000, acceptedQty: 980 }],
    });
    expect(grn.lines).toHaveLength(1);
    expect((grn.lines as Row[])[0]!.rejectedQty).toBe(20);
    expect(f.db.pos[0]!.status).toBe("received");
    expect(f.db.pos[0]!.receivedInFull).toBe(true);
    expect(Number(f.db.poLines[0]!.receivedQty)).toBe(1000);
    expect(f.db.stock[0]!.stockQty).toBe(980);
  });

  it("rejects over-receipt beyond the outstanding PO quantity", async () => {
    await seedChain(f.db);
    const q = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    const po = await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: q.id, poNo: "PO-001", projectId: PROJECT });
    const poLine = (po.lines as Row[])[0]!;
    await expect(svc.receiveGrn(T, {
      grnNo: "GRN-X", orderId: po.id, projectId: PROJECT, receivedAt: new Date(),
      lines: [{ poLineId: poLine.id, qty: 1200, acceptedQty: 1200 }],
    })).rejects.toThrow(BadRequestException);
  });

  it("rejects accepted quantity greater than received quantity", async () => {
    await seedChain(f.db);
    const q = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    const po = await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: q.id, poNo: "PO-001", projectId: PROJECT });
    const poLine = (po.lines as Row[])[0]!;
    await expect(svc.receiveGrn(T, {
      grnNo: "GRN-Y", orderId: po.id, projectId: PROJECT, receivedAt: new Date(),
      lines: [{ poLineId: poLine.id, qty: 100, acceptedQty: 150 }],
    })).rejects.toThrow(BadRequestException);
  });

  it("partial receipt marks PO partial, not received", async () => {
    await seedChain(f.db);
    const q = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    const po = await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: q.id, poNo: "PO-001", projectId: PROJECT });
    const poLine = (po.lines as Row[])[0]!;
    await svc.receiveGrn(T, {
      grnNo: "GRN-P1", orderId: po.id, projectId: PROJECT, receivedAt: new Date(),
      lines: [{ poLineId: poLine.id, qty: 400, acceptedQty: 400 }],
    });
    expect(f.db.pos[0]!.status).toBe("partial");
    expect(f.db.pos[0]!.receivedInFull).toBe(false);
  });

  it("vendor rating: on-time + acceptance composite bands", async () => {
    await seedChain(f.db);
    const q = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    const po = await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: q.id, poNo: "PO-001", projectId: PROJECT, promisedDate: new Date("2026-09-10") });
    const poLine = (po.lines as Row[])[0]!;
    await svc.receiveGrn(T, {
      grnNo: "GRN-001", orderId: po.id, projectId: PROJECT, receivedAt: new Date("2026-09-09"),
      lines: [{ poLineId: poLine.id, qty: 1000, acceptedQty: 950 }],
    });
    const rating = await svc.vendorRating(T, "v-low");
    expect(rating.grnCount).toBe(1);
    expect(rating.onTimePct).toBe(100);
    expect(rating.acceptancePct).toBe(95);
    expect(rating.score).toBe(98); // 0.5*100 + 0.5*95 = 97.5 → 98
    expect(rating.band).toBe("A");
  });

  it("vendor rating for a vendor with no receipts is unrated", async () => {
    f.db.vendors.push({ id: "v-new", tenantId: T, code: "V9", name: "New vendor", status: "active" });
    const rating = await svc.vendorRating(T, "v-new");
    expect(rating.band).toBe("unrated");
    expect(rating.score).toBeNull();
  });

  it("blocks duplicate vendor codes and duplicate GRN numbers", async () => {
    f.db.vendors.push({ id: "v-1", tenantId: T, code: "V1", name: "Exists", status: "active" });
    await expect(svc.createVendor(T, { code: "V1", name: "Dup" })).rejects.toThrow(ConflictException);
    f.db.grns.push({ id: "g-1", tenantId: T, grnNo: "GRN-1", orderId: "po-1", projectId: PROJECT, vendorId: "v-1", status: "posted", receivedAt: new Date() });
    await expect(svc.receiveGrn(T, {
      grnNo: "GRN-1", orderId: "po-1", projectId: PROJECT, receivedAt: new Date(),
      lines: [{ poLineId: "pol-1", qty: 1, acceptedQty: 1 }],
    })).rejects.toThrow(ConflictException);
  });

  it("GRN against a non-existent PO 404s; GRN line from another PO 400s", async () => {
    await expect(svc.receiveGrn(T, {
      grnNo: "GRN-404", orderId: "nope", projectId: PROJECT, receivedAt: new Date(),
      lines: [{ poLineId: "pol-1", qty: 1, acceptedQty: 1 }],
    })).rejects.toThrow(NotFoundException);
    await seedChain(f.db);
    const q = await svc.receiveQuote(T, {
      rfqId: "rfq-1", vendorId: "v-low", deliveryDays: 7,
      lines: [{ materialId: "M-CEM", qty: 1000, ratePaise: 38500n }],
    });
    const po = await svc.awardQuote(T, { rfqId: "rfq-1", quoteId: q.id, poNo: "PO-001", projectId: PROJECT });
    await expect(svc.receiveGrn(T, {
      grnNo: "GRN-Z", orderId: po.id, projectId: PROJECT, receivedAt: new Date(),
      lines: [{ poLineId: "pol-from-elsewhere", qty: 1, acceptedQty: 1 }],
    })).rejects.toThrow(BadRequestException);
  });

  it("lists purchase requisitions with lines", async () => {
    f.db.prs.push({ id: "pr-list", tenantId: T, reqNo: "PR-L", projectId: PROJECT, status: "draft" });
    f.db.prLines.push({ id: "ln-list", requisitionId: "pr-list", materialId: "M-CEM", qty: 10 });
    const rows = await svc.listPrs(T) as Array<{ reqNo: string; lines: unknown[] }>;
    expect(rows[0]!.reqNo).toBe("PR-L");
    expect(rows[0]!.lines).toHaveLength(1);
  });

  it("lists vendors for the tenant", async () => {
    f.db.vendors.push({ id: "v-list", tenantId: T, code: "V-L", name: "Steel Co" });
    const rows = await svc.listVendors(T) as Array<{ code: string }>;
    expect(rows.map((r) => r.code)).toContain("V-L");
  });

  it("lists RFQs for the tenant", async () => {
    f.db.rfqs.push({ id: "rfq-l", tenantId: T, rfqNo: "RFQ-L", status: "open" });
    const rows = await svc.listRfqs(T) as Array<{ rfqNo: string }>;
    expect(rows[0]!.rfqNo).toBe("RFQ-L");
  });

  it("lists GRNs with lines", async () => {
    f.db.grns.push({ id: "g-list", tenantId: T, grnNo: "GRN-L", orderId: "po-1", projectId: PROJECT, status: "posted", receivedAt: new Date() });
    f.db.grnLines.push({ id: "gl-list", grnId: "g-list", poLineId: "pol-1", qty: 10, acceptedQty: 8, rejectedQty: 2 });
    const rows = await svc.listGrns(T) as Array<{ grnNo: string; lines: unknown[] }>;
    expect(rows[0]!.grnNo).toBe("GRN-L");
    expect(rows[0]!.lines).toHaveLength(1);
  });
});
