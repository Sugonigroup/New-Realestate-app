import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { LandService } from "./land.service.js";
import { ReraComplianceService } from "../compliance/rera-compliance.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    parcels: [] as Row[],
    jdas: [] as Row[],
    certs: [] as Row[],
    withdrawals: [] as Row[],
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
    landParcel: {
      findFirst: vi.fn(async ({ where }: any) => db.parcels.find(match(where))),
      findMany: vi.fn(async ({ where }: any) => db.parcels.filter(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("pcl"), ...data }; db.parcels.push(r); return r; }),
    },
    jointDevelopmentAgreement: {
      findFirst: vi.fn(async ({ where, include }: any) => {
        const j = db.jdas.find(match(where));
        if (!j) return null;
        const res = { ...j };
        if (include?.landParcel) res.landParcel = db.parcels.find((x) => x.id === j.landParcelId);
        return res;
      }),
      findMany: vi.fn(async ({ where, include }: any) => db.jdas.filter(match(where)).map((j) => ({
        ...j,
        landParcel: include?.landParcel ? db.parcels.find((x) => x.id === j.landParcelId) : undefined,
      }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("jda"), ...data }; db.jdas.push(r); return r; }),
    },
    reraCertificate: {
      findFirst: vi.fn(async ({ where }: any) => db.certs.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("crt"), ...data }; db.certs.push(r); return r; }),
    },
    reraEscrowWithdrawal: {
      findFirst: vi.fn(async ({ where }: any) => db.withdrawals.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("wdr"), ...data }; db.withdrawals.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.withdrawals.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
  };

  return { prisma, db };
}

const T = "t-1";
const PROJ = "11111111-1111-1111-1111-111111111111";

describe("Land Acquisition (LAND-01) & RERA Escrow Gate (RERA-01)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let landSvc: LandService;
  let reraSvc: ReraComplianceService;

  beforeEach(() => {
    f = fakePrisma();
    landSvc = new LandService(f.prisma as never);
    reraSvc = new ReraComplianceService(f.prisma as never);
  });

  // ── LAND-01 Land & JDA Split ─────────────────────────────────────────────

  it("registers land parcel and blocks JDA execution on encumbered/litigated title", async () => {
    const parcel = await landSvc.registerLandParcel(T, {
      parcelNo: "PCL-01", surveyNo: "Survey #45/2", location: "Whitefield, Bengaluru",
      areaSqFt: 100000, purchaseValPaise: 50_00_00_000_00n, // ₹50 Crore
      titleStatus: "litigation",
    });
    expect(parcel.parcelNo).toBe("PCL-01");

    await expect(landSvc.executeJda(T, {
      jdaNo: "JDA-01", landParcelId: parcel.id, landownerName: "Reddy Family Trust",
      landownerSharePct: 40, developerSharePct: 60,
    })).rejects.toThrow(BadRequestException);
  });

  it("executes JDA on clear title land and calculates revenue & area split accurately", async () => {
    const parcel = await landSvc.registerLandParcel(T, {
      parcelNo: "PCL-02", surveyNo: "Survey #88/1", location: "HSR Layout, Bengaluru",
      areaSqFt: 200000, purchaseValPaise: 100_00_00_000_00n, // ₹100 Crore
      titleStatus: "clear",
    });

    const jda = await landSvc.executeJda(T, {
      jdaNo: "JDA-02", landParcelId: parcel.id, landownerName: "Gowda Estates",
      landownerSharePct: 35, developerSharePct: 65, revenueSharePct: 35,
    });
    expect(jda.status).toBe("active");

    const split = await landSvc.calculateJdaSplit(T, "JDA-02", 500_00_00_000_00n); // ₹500 Cr project revenue
    expect(split.landownerAreaSqFt).toBe(70000); // 35% of 200,000 sq ft
    expect(split.landownerRevenuePaise).toBe(175_00_00_000_00n); // ₹175 Cr (35%)
    expect(split.developerRevenuePaise).toBe(325_00_00_000_00n); // ₹325 Cr (65%)

    const parcels = await landSvc.listParcels(T) as Array<{ parcelNo: string }>;
    expect(parcels.map((p) => p.parcelNo)).toContain("PCL-02");
    const jdas = await landSvc.listJdas(T) as Array<{ jdaNo: string }>;
    expect(jdas[0]!.jdaNo).toBe("JDA-02");
  });

  // ── RERA-01 Certificates & Escrow Withdrawal Gate ──────────────────────

  it("issues Form 1/2/3 certificates and enforces Form 3 CA max withdrawable limit gate", async () => {
    const f1 = await reraSvc.issueCertificate(T, {
      certNo: "CERT-F1-01", projectId: PROJ, certType: "Form1_Architect",
      issuerName: "Arch. Mehta & Associates", issuerRegNo: "CA/2012/55441",
      period: "Q2_2026", certifiedPct: 45.0,
    });

    const f2 = await reraSvc.issueCertificate(T, {
      certNo: "CERT-F2-01", projectId: PROJ, certType: "Form2_Engineer",
      issuerName: "Eng. Rao Structural Consultants", issuerRegNo: "MIE-998877",
      period: "Q2_2026", certifiedPct: 42.5,
    });

    const f3 = await reraSvc.issueCertificate(T, {
      certNo: "CERT-F3-01", projectId: PROJ, certType: "Form3_CA",
      issuerName: "KPMG Chartered Accountants", issuerRegNo: "FRN-101112W",
      period: "Q2_2026", certifiedPct: 40.0,
    });

    // Attempt withdrawal exceeding Form 3 CA max limit (₹10 Cr max, requesting ₹12 Cr)
    await expect(reraSvc.requestEscrowWithdrawal(T, {
      requestNo: "WDR-01", projectId: PROJ,
      requestedPaise: 12_00_00_000_00n,
      maxWithdrawablePaise: 10_00_00_000_00n,
      form1ArchitectCertId: f1.id, form2EngineerCertId: f2.id, form3CaCertId: f3.id,
    })).rejects.toThrow(BadRequestException);

    // Valid withdrawal within Form 3 CA limit (requesting ₹8 Cr <= ₹10 Cr)
    const req = await reraSvc.requestEscrowWithdrawal(T, {
      requestNo: "WDR-02", projectId: PROJ,
      requestedPaise: 8_00_00_000_00n,
      maxWithdrawablePaise: 10_00_00_000_00n,
      form1ArchitectCertId: f1.id, form2EngineerCertId: f2.id, form3CaCertId: f3.id,
    });
    expect(req.status).toBe("requested");

    const app = await reraSvc.approveWithdrawal(T, "WDR-02", "cfo.iyer@buildos.internal");
    expect(app.status).toBe("withdrawn");
  });
});
