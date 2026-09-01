import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { HrLifecycleService } from "./hr-lifecycle.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    reqs: [] as Row[],
    candidates: [] as Row[],
    offers: [] as Row[],
    exits: [] as Row[],
    employees: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(row[k]);
      return row[k] === v;
    });
  }

  const prisma = {
    jobRequisition: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const r = db.reqs.find(match(where));
        if (!r) return null;
        const res = { ...r };
        if (include?.candidates) res.candidates = db.candidates.filter((c) => c.requisitionId === r.id);
        return res;
      }),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("req"), ...data }; db.reqs.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.reqs.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    jobCandidate: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const c = db.candidates.find(match(where));
        if (!c) return null;
        const res = { ...c };
        if (include) res.offers = db.offers.filter((o) => o.candidateId === c.id);
        return res;
      }),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("cand"), ...data }; db.candidates.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.candidates.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
      findMany: vi.fn(async ({ where, include }: any) => {
        return db.candidates.filter(match(where)).map((c) => ({
          ...c,
          requisition: include?.requisition ? db.reqs.find((r) => r.id === c.requisitionId) : undefined,
        }));
      }),
    },
    jobOffer: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const o = db.offers.find(match(where));
        if (!o) return null;
        const res = { ...o };
        if (include?.candidate) res.candidate = db.candidates.find((c) => c.id === o.candidateId);
        return res;
      }),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("off"), ...data }; db.offers.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.offers.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    employeeExit: {
      findFirst: vi.fn(async ({ where }: any) => db.exits.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("ext"), ...data }; db.exits.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.exits.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    employee: {
      findFirst: vi.fn(async ({ where }: any) => db.employees.find(match(where))),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.employees.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("HrLifecycleService (HR-01)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: HrLifecycleService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new HrLifecycleService(f.prisma as never);
  });

  it("enforces maker-checker on requisition approval and rejects self-approval", async () => {
    const req = await svc.createRequisition(T, {
      reqNo: "REQ-001", position: "Site Engineer", department: "Projects", requesterId: "user-hr-1",
    });
    await expect(svc.approveRequisition(T, "REQ-001", "user-hr-1")).rejects.toThrow(BadRequestException);

    const approved = await svc.approveRequisition(T, "REQ-001", "user-hr-head");
    expect(approved.status).toBe("open");
  });

  it("walks the candidate pipeline state machine and issues an offer after interview", async () => {
    f.db.reqs.push({ id: "req-1", tenantId: T, reqNo: "REQ-002", status: "open", headcount: 1, requestedBy: "u1" });

    const cand = await svc.addCandidate(T, {
      requisitionId: "req-1", name: "Ravi Menon", phone: "+919812345678",
      source: "portal" as const,
    });
    expect(cand.stage).toBe("applied");

    // Cannot offer before interview stage
    await expect(svc.issueOffer(T, {
      offerNo: "OFR-001", candidateId: cand.id, offeredCtcPaise: 12_00_000_00n,
      validUntil: new Date(Date.now() + 7 * 86400000),
    })).rejects.toThrow(ConflictException);

    await svc.moveCandidateStage(T, cand.id, "advance"); // applied → screening
    await svc.moveCandidateStage(T, cand.id, "advance", 4); // screening → interview, rating 4
    expect(f.db.candidates[0]!.stage).toBe("interview");
    expect(f.db.candidates[0]!.rating).toBe(4);

    const offer = await svc.issueOffer(T, {
      offerNo: "OFR-001", candidateId: cand.id, offeredCtcPaise: 12_00_000_00n,
      validUntil: new Date(Date.now() + 7 * 86400000),
    });
    expect(offer.status).toBe("sent");
    expect(f.db.candidates[0]!.stage).toBe("offer_sent");
  });

  it("accepts offer, marks joined, and auto-fills the requisition at headcount", async () => {
    f.db.reqs.push({ id: "req-1", tenantId: T, reqNo: "REQ-003", status: "open", headcount: 1, requestedBy: "u1" });
    f.db.candidates.push({ id: "cand-1", tenantId: T, requisitionId: "req-1", name: "Asha Nair", stage: "interview" });
    f.db.offers.push({
      id: "off-1", tenantId: T, offerNo: "OFR-002", candidateId: "cand-1",
      offeredCtcPaise: 10_00_000_00n, status: "sent", validUntil: new Date(Date.now() + 86400000),
    });

    await svc.respondOffer(T, "OFR-002", true);
    expect(f.db.candidates[0]!.stage).toBe("offer_accepted");

    await svc.markJoined(T, "OFR-002", new Date());
    expect(f.db.candidates[0]!.stage).toBe("joined");
    expect(f.db.reqs[0]!.status).toBe("filled"); // headcount 1 reached
  });

  it("rejects responses to expired offers", async () => {
    f.db.candidates.push({ id: "cand-9", tenantId: T, requisitionId: "req-x", name: "Old", stage: "offer_sent" });
    f.db.offers.push({
      id: "off-9", tenantId: T, offerNo: "OFR-EXP", candidateId: "cand-9",
      offeredCtcPaise: 5_00_000_00n, status: "sent", validUntil: new Date(Date.now() - 86400000),
    });
    await expect(svc.respondOffer(T, "OFR-EXP", true)).rejects.toThrow(ConflictException);
  });

  it("initiates exit with F&F dues clearance and marks the employee exited", async () => {
    f.db.employees.push({ id: "emp-1", tenantId: T, code: "EMP-1001", name: "Rajesh", status: "active" });

    const exit = await svc.initiateExit(T, {
      employeeId: "emp-1", reason: "resignation" as const,
      noticeDays: 60, lastWorkingDay: new Date(Date.now() + 60 * 86400000),
    });
    expect(exit.status).toBe("initiated");

    // No duplicate exit while one is in progress
    await expect(svc.initiateExit(T, {
      employeeId: "emp-1", reason: "termination" as const, lastWorkingDay: new Date(),
    })).rejects.toThrow(ConflictException);

    const cleared = await svc.clearExit(T, "emp-1", 85_000_00n, "hr-head");
    expect(cleared.status).toBe("exited");
    expect(cleared.duesSettledPaise).toBe(85_000_00n);
    expect(f.db.employees[0]!.status).toBe("exited");
  });

  it("lists candidates with requisition fields", async () => {
    f.db.reqs.push({ id: "req-l", tenantId: T, reqNo: "REQ-L", position: "Site Engineer" });
    f.db.candidates.push({ id: "cand-l", tenantId: T, requisitionId: "req-l", name: "Ravi", stage: "interview" });
    const rows = await svc.listCandidates(T) as Array<{ name: string; requisition: { reqNo: string } }>;
    expect(rows[0]!.name).toBe("Ravi");
    expect(rows[0]!.requisition.reqNo).toBe("REQ-L");
  });
});
