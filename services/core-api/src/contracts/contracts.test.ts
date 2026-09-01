import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ContractsService } from "./contracts.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    contracts: [] as Row[],
    clauses: [] as Row[],
    obligations: [] as Row[],
    claims: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;
  const child = (parentId: string, fk: string, create: any[], collection: string) =>
    (create as any[]).map((l) => {
      const lr = { id: nid("ln"), ...l, [fk]: parentId };
      (db as any)[collection].push(lr);
      return lr;
    });

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "lt" in (v as object)) return (row[k] as Date) < (v as { lt: Date }).lt;
      return row[k] === v;
    });
  }

  const prisma = {
    legalContract: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const c = db.contracts.find(match(where));
        if (!c) return null;
        const res = { ...c };
        if (include?.clauses) res.clauses = db.clauses.filter((x) => x.contractId === c.id);
        if (include?.obligations) res.obligations = db.obligations.filter((x) => x.contractId === c.id);
        if (include?.claims) res.claims = db.claims.filter((x) => x.contractId === c.id);
        return res;
      }),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("ctr"), status: "draft", ...data };
        if (data.clauses?.create) r.clauses = child(r.id, "contractId", data.clauses.create, "clauses");
        if (data.obligations?.create) r.obligations = child(r.id, "contractId", data.obligations.create, "obligations");
        db.contracts.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.contracts.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
      findMany: vi.fn(async ({ where, include }: any) =>
        db.contracts.filter(match(where)).map((c) => ({
          ...c,
          clauses: include?.clauses ? db.clauses.filter((x) => x.contractId === c.id) : undefined,
          claims: include?.claims ? db.claims.filter((x) => x.contractId === c.id) : undefined,
          obligations: include?.obligations ? db.obligations.filter((x) => x.contractId === c.id) : undefined,
        })),
      ),
    },
    contractClause: {
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("cls"), versionNo: 1, isStandard: true, riskLevel: "low", ...data };
        db.clauses.push(r);
        return r;
      }),
    },
    contractObligation: {
      findFirst: vi.fn(async ({ where }: any) => db.obligations.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.obligations.filter(match(where))),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.obligations.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    contractClaim: {
      findFirst: vi.fn(async ({ where }: any) => db.claims.find(match(where))),
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("clm"), status: "open", ...data };
        db.claims.push(r);
        return r;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.claims.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("ContractsService", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: ContractsService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new ContractsService(f.prisma as never);
  });

  it("creates a draft contract with clauses and obligations", async () => {
    const ctr = await svc.createContract(T, {
      contractNo: "CTR-001", title: "RCC Structural Work", partyName: "L&T Construction",
      partyRole: "contractor", totalPaise: 50_00_00_000n, effectiveFrom: new Date("2026-09-01"),
      clauses: [{ sectionNo: "1.1", title: "Scope", bodyText: "Cast RCC frame per design" }],
      obligations: [{ title: "Submit Bank Guarantee", dueOn: new Date("2026-09-15"), ownerRole: "contractor" }],
    });
    expect(ctr.contractNo).toBe("CTR-001");
    expect(ctr.status).toBe("draft");
    expect(f.db.clauses).toHaveLength(1);
    expect(f.db.obligations).toHaveLength(1);
  });

  it("blocks duplicate contract numbers", async () => {
    f.db.contracts.push({ id: "c-1", tenantId: T, contractNo: "CTR-001", status: "draft" });
    await expect(svc.createContract(T, {
      contractNo: "CTR-001", title: "Dup", partyName: "A", partyRole: "vendor",
      totalPaise: 100n, effectiveFrom: new Date(),
    })).rejects.toThrow(ConflictException);
  });

  it("requires signedAt timestamp when activating a contract with critical risk clauses", async () => {
    f.db.contracts.push({ id: "c-crit", tenantId: T, contractNo: "CTR-CRIT", status: "draft" });
    f.db.clauses.push({ id: "cl-crit", tenantId: T, contractId: "c-crit", riskLevel: "critical" });
    await expect(svc.activateContract(T, "c-crit", null as any)).rejects.toThrow(BadRequestException);
    const active = await svc.activateContract(T, "c-crit", new Date("2026-09-01"));
    expect(active.status).toBe("active");
  });

  it("fulfills an obligation and prevents re-fulfillment", async () => {
    f.db.obligations.push({ id: "ob-1", tenantId: T, title: "Submit BG", status: "pending" });
    const ful = await svc.fulfillObligation(T, "ob-1");
    expect(ful.status).toBe("fulfilled");
    await expect(svc.fulfillObligation(T, "ob-1")).rejects.toThrow(ConflictException);
  });

  it("sweeps overdue obligations whose due date has passed", async () => {
    f.db.obligations.push({ id: "ob-past", tenantId: T, title: "Past Due", status: "pending", dueOn: new Date(Date.now() - 86400000) });
    f.db.obligations.push({ id: "ob-future", tenantId: T, title: "Future", status: "pending", dueOn: new Date(Date.now() + 86400000) });
    const sweep = await svc.sweepOverdueObligations(T);
    expect(sweep.sweptCount).toBe(1);
    expect(f.db.obligations.find((x) => x.id === "ob-past")!.status).toBe("overdue");
    expect(f.db.obligations.find((x) => x.id === "ob-future")!.status).toBe("pending");
  });

  it("raises and settles a claim within claimed amount limit", async () => {
    f.db.contracts.push({ id: "c-clm", tenantId: T, contractNo: "CTR-CLM", status: "active", totalPaise: 1_00_00_000n });
    const claim = await svc.raiseClaim(T, {
      contractId: "c-clm", claimNo: "CLM-001", raisedBy: "counterparty",
      nature: "delay_penalty", amountPaise: 10_00_000n,
    });
    expect(claim.claimNo).toBe("CLM-001");
    expect(claim.status).toBe("open");

    await expect(svc.settleClaim(T, claim.id, 15_00_000n)).rejects.toThrow(BadRequestException);
    const settled = await svc.settleClaim(T, claim.id, 8_00_000n);
    expect(settled.status).toBe("settled");
    expect(settled.settledPaise).toBe(8_00_000n);
  });

  it("calculates comprehensive risk profile: exposure %, claims count, risk score", async () => {
    f.db.contracts.push({ id: "c-rk", tenantId: T, contractNo: "CTR-RISK", status: "active", totalPaise: 10_00_000n });
    f.db.clauses.push({ id: "cl-1", tenantId: T, contractId: "c-rk", riskLevel: "high" });
    f.db.clauses.push({ id: "cl-2", tenantId: T, contractId: "c-rk", riskLevel: "high" });
    f.db.clauses.push({ id: "cl-3", tenantId: T, contractId: "c-rk", riskLevel: "critical" });
    f.db.clauses.push({ id: "cl-4", tenantId: T, contractId: "c-rk", riskLevel: "critical" });
    f.db.claims.push({ id: "cm-1", tenantId: T, contractId: "c-rk", claimNo: "C1", status: "open", amountPaise: 3_00_000n });

    const risk = await svc.riskProfile(T, "c-rk");
    expect(risk.exposureVsContractPct).toBe(30); // ₹3L open claim vs ₹10L total = 30%
    expect(risk.openClaimsCount).toBe(1);
    expect(risk.highRiskClausesCount).toBe(4);
    expect(risk.riskLevel).toBe("HIGH"); // >20% exposure + >3 high risk clauses
  });

  it("lists contracts with clauses and claims for the tenant", async () => {
    f.db.contracts.push({ id: "c-list", tenantId: T, contractNo: "CTR-LIST", status: "active" });
    f.db.clauses.push({ id: "cl-l", tenantId: T, contractId: "c-list", riskLevel: "high" });
    const rows = await svc.listContracts(T) as Array<{ contractNo: string; clauses: unknown[] }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.contractNo).toBe("CTR-LIST");
    expect(rows[0]!.clauses).toHaveLength(1);
  });
});
