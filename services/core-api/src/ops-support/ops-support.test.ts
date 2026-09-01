import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { OpsSupportService } from "./ops-support.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    risks: [] as Row[],
    tickets: [] as Row[],
    findings: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      return row[k] === v;
    });
  }

  const prisma = {
    riskRegister: {
      findFirst: vi.fn(async ({ where }: any) => db.risks.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.risks.filter(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("rsk"), ...data };
        db.risks.push(r);
        return r;
      }),
    },
    customerTicket: {
      findFirst: vi.fn(async ({ where }: any) => db.tickets.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.tickets.filter(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("tkt"), ...data };
        db.tickets.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.tickets.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    auditFinding: {
      findFirst: vi.fn(async ({ where }: any) => db.findings.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.findings.filter(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("fnd"), ...data };
        db.findings.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.findings.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("OpsSupportService", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: OpsSupportService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new OpsSupportService(f.prisma as never);
  });

  it("registers a risk with 5x5 probability x impact score and generates heatmap breakdown", async () => {
    const r1 = await svc.registerRisk(T, {
      riskNo: "RSK-01", title: "Cement Price Volatility", category: "financial",
      probability: 4, impact: 4, ownerRole: "procurement_manager",
    });
    expect(r1.riskScore).toBe(16); // 4 * 4 = 16 (CRITICAL)

    await svc.registerRisk(T, {
      riskNo: "RSK-02", title: "Monsoon Delay", category: "schedule",
      probability: 3, impact: 3, ownerRole: "project_manager",
    }); // 9 (MEDIUM)

    const map = await svc.highRiskHeatmap(T);
    expect(map.totalOpenRisks).toBe(2);
    expect(map.criticalCount).toBe(1);
    expect(map.mediumCount).toBe(1);
    expect(map.topRisks[0]!.riskNo).toBe("RSK-01");
  });

  it("rejects out-of-bounds probability or impact values", async () => {
    await expect(svc.registerRisk(T, {
      riskNo: "RSK-X", title: "Bad Prob", category: "safety",
      probability: 6, impact: 3, ownerRole: "pm",
    })).rejects.toThrow(BadRequestException);
  });

  it("raises ticket, resolves with CSAT rating, and computes SLA breach % and average CSAT", async () => {
    const duePast = new Date(Date.now() - 3600000);
    const dueFuture = new Date(Date.now() + 3600000 * 48);

    await svc.raiseTicket(T, {
      ticketNo: "TKT-01", customerName: "John Doe", customerPhone: "+919876543210",
      category: "leakage", description: "Water dripping from ceiling", dueOn: duePast,
    });

    await svc.raiseTicket(T, {
      ticketNo: "TKT-02", customerName: "Jane Smith", customerPhone: "+919876543211",
      category: "electrical", description: "MCB tripping", dueOn: dueFuture,
    });

    // Resolve TKT-01 with CSAT 4
    await svc.resolveTicket(T, "TKT-01", 4);
    // Resolve TKT-02 with CSAT 5
    await svc.resolveTicket(T, "TKT-02", 5);

    const metrics = await svc.csatAndSlaMetrics(T);
    expect(metrics.totalTickets).toBe(2);
    expect(metrics.resolvedCount).toBe(2);
    expect(metrics.avgCsat).toBe(4.5);
    expect(metrics.slaBreaches).toBe(1); // TKT-01 resolved past due date
  });

  it("registers audit finding, submits CAPA plan, and closes upon verification", async () => {
    const fnd = await svc.raiseFinding(T, {
      findingNo: "AUD-01", auditedModule: "procurement", title: "Missing GRN Inspection Signatures",
      description: "3 GRNs accepted without QA inspector stamp", severity: "high", dueOn: new Date(),
    });
    expect(fnd.status).toBe("open");

    // Cannot close directly without CAPA plan
    await expect(svc.closeFinding(T, "AUD-01")).rejects.toThrow(BadRequestException);

    const capa = await svc.submitCapa(T, "AUD-01", "Mandated digital QA stamp in ERP GRN workflow");
    expect(capa.status).toBe("capa_submitted");

    const closed = await svc.closeFinding(T, "AUD-01");
    expect(closed.status).toBe("closed");
  });

  it("lists risks ordered by score", async () => {
    await svc.registerRisk(T, {
      riskNo: "RSK-L", title: "Steel inflation", category: "financial",
      probability: 4, impact: 5, ownerRole: "cfo",
    });
    const rows = await svc.listRisks(T) as Array<{ riskNo: string; riskScore: number }>;
    expect(rows[0]!.riskNo).toBe("RSK-L");
    expect(rows[0]!.riskScore).toBe(20);
  });

  it("lists tickets for the tenant", async () => {
    f.db.tickets.push({ id: "t-l", tenantId: T, ticketNo: "TKT-L", status: "open" });
    const rows = await svc.listTickets(T) as Array<{ ticketNo: string }>;
    expect(rows[0]!.ticketNo).toBe("TKT-L");
  });

  it("lists audit findings for the tenant", async () => {
    f.db.findings.push({ id: "f-l", tenantId: T, findingNo: "AUD-L", status: "open" });
    const rows = await svc.listFindings(T) as Array<{ findingNo: string }>;
    expect(rows[0]!.findingNo).toBe("AUD-L");
  });
});
