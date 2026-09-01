/**
 * Phase 0 seed — reference tenant per `phases/phase-0-foundations.md` (WP-0C):
 * "Shree Developers (₹500Cr demo)": 2 entities, 3 verticals, 2 projects, 20 units,
 * role templates from @buildos/permissions, one super-admin user.
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_TEMPLATES } from "@buildos/permissions";
import { hashPassword } from "../src/auth/password.js";
import { seedFinanceBooks } from "./seed-finance.js";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "shree-developers" },
    update: {},
    create: { name: "Shree Developers (₹500Cr demo)", slug: "shree-developers" },
  });

  // Roles from the permission templates (permissions are the truth).
  for (const role of ROLE_TEMPLATES) {
    const existing = await prisma.role.findFirst({
      where: { tenantId: tenant.id, code: role.code },
    });
    if (!existing) {
      const created = await prisma.role.create({
        data: { tenantId: tenant.id, code: role.code, name: role.name, template: role.code },
      });
      for (const grant of role.permissions) {
        await prisma.permission.create({ data: { roleId: created.id, grant } });
      }
      for (const grant of role.denied ?? []) {
        await prisma.permission.create({ data: { roleId: created.id, grant, isDeny: true } });
      }
    }
    else {
      for (const grant of role.permissions) {
        const has = await prisma.permission.findFirst({ where: { roleId: existing.id, grant, isDeny: false } });
        if (!has) await prisma.permission.create({ data: { roleId: existing.id, grant } });
      }
    }
  }

  const entityCount = await prisma.orgEntity.count({ where: { tenantId: tenant.id } });
  let entityId1: string;
  let entityId2: string;
  if (entityCount === 0) {
    const e1 = await prisma.orgEntity.create({
      data: { tenantId: tenant.id, name: "Shree Urja Homes Pvt Ltd", legalName: "Shree Urja Homes Private Limited", gstin: "29ABCDE1234F1Z5", stateCode: "KA" },
    });
    const e2 = await prisma.orgEntity.create({
      data: { tenantId: tenant.id, name: "Shree Commercial Spaces LLP", legalName: "Shree Commercial Spaces LLP", gstin: "27ABCDE1234F1Z2", stateCode: "MH" },
    });
    entityId1 = e1.id;
    entityId2 = e2.id;
  } else {
    const entities = await prisma.orgEntity.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } });
    entityId1 = entities[0]!.id;
    entityId2 = entities[1]!.id;
  }

  const vCount = await prisma.vertical.count({ where: { tenantId: tenant.id } });
  if (vCount === 0) {
    await prisma.vertical.createMany({
      data: [
        { tenantId: tenant.id, entityId: entityId1, name: "Residential Mid", segment: "residential" },
        { tenantId: tenant.id, entityId: entityId1, name: "Plotted", segment: "plotted" },
        { tenantId: tenant.id, entityId: entityId2, name: "Commercial Office", segment: "commercial" },
      ],
    });
  }
  const verticals = await prisma.vertical.findMany({ where: { tenantId: tenant.id }, orderBy: { createdAt: "asc" } });

  const pCount = await prisma.project.count({ where: { tenantId: tenant.id } });
  if (pCount === 0) {
    await prisma.project.createMany({
      data: [
        {
          tenantId: tenant.id, entityId: entityId1, verticalId: verticals[0]!.id,
          code: "VRD", name: "Verde Residences", segmentKind: "residential",
          city: "Bengaluru", state: "Karnataka", reraNumber: "PRM/KA/RERA/1251/446/PR/2024/VRD",
          status: "under_construction",
          startDate: new Date("2025-01-15"), endDate: new Date("2027-12-31"),
        },
        {
          tenantId: tenant.id, entityId: entityId2, verticalId: verticals[2]!.id,
          code: "ATR", name: "Atrium Business Park", segmentKind: "commercial",
          city: "Pune", state: "Maharashtra", reraNumber: "P52100047382",
          status: "planning",
          startDate: new Date("2026-01-01"), endDate: new Date("2028-06-30"),
        },
      ],
    });
  }

  const verde = await prisma.project.findFirst({ where: { tenantId: tenant.id, code: "VRD" } });
  const unitCount = await prisma.unit.count({ where: { projectId: verde!.id } });
  if (unitCount === 0) {
    const units = [];
    for (let floor = 1; floor <= 4; floor++) {
      for (let i = 1; i <= 5; i++) {
        units.push({
          tenantId: tenant.id, projectId: verde!.id,
          code: `T1-${floor}0${i}`, tower: "T1", floor,
          unitType: i % 2 === 0 ? "3BHK" : "2BHK",
          carpetSqm: i % 2 === 0 ? 92.5 : 68.0,
          sbuaSqm: i % 2 === 0 ? 138.7 : 101.8,
        });
      }
    }
    await prisma.unit.createMany({ data: units });
  }

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: "admin@shree.example" },
  });
  if (!admin) {
    const superAdminRole = await prisma.role.findFirst({
      where: { tenantId: tenant.id, code: "super_admin" },
    });
    const u = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: "admin@shree.example",
        fullName: "Demo Admin",
        status: "active",
        passwordHash: hashPassword("Buildos@demo1"),
      },
    });
    await prisma.userRole.create({
      data: { tenantId: tenant.id, userId: u.id, roleId: superAdminRole!.id, scope: "ALL" },
    });
  } else if (!admin.passwordHash) {
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash: hashPassword("Buildos@demo1") },
    });
  }

  await prisma.numberSeries.upsert({
    where: { tenantId_entityId_seriesKey: { tenantId: tenant.id, entityId: entityId1, seriesKey: "receipt" } },
    update: {},
    create: { tenantId: tenant.id, entityId: entityId1, seriesKey: "receipt", prefix: "RCPT", gapless: true },
  });

  console.log("Seed complete: 16-module demo — tenant, entities, verticals, projects, units, roles, admin, campaign, employees, contractor, activities, milestones, material stock, PO, statutory filings.");

  // ── Full 16-module demo data ──
  const project = await prisma.project.findFirst({ where: { tenantId: tenant.id, code: "VRD" } });
  if (!project) throw new Error("VRD project not found after creation");

  // Marketing: campaign + spend
  const campaignExists = await prisma.campaign.findFirst({ where: { tenantId: tenant.id, name: "Verde Launch — Meta" } });
  if (!campaignExists) {
    const c = await prisma.campaign.create({ data: { tenantId: tenant.id, projectId: project.id, name: "Verde Launch — Meta", channel: "meta" } });
    await prisma.campaignSpend.createMany({
      data: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
        tenantId: tenant.id, campaignId: c.id,
        date: new Date(Date.UTC(2026, 8, d)),
        spendPaise: BigInt(500_000 + d * 10_000), leads: 15 + d,
      })),
    });
  }

  // HR: employees, contractor, attendance
  const contractorExists = await prisma.contractor.findFirst({ where: { tenantId: tenant.id, code: "CTR-1" } });
  if (!contractorExists) {
    await prisma.contractor.create({
      data: { tenantId: tenant.id, code: "CTR-1", name: "Shree Constructions", clraExpiry: new Date("2027-06-30") },
    });
  }
  const empCount = await prisma.employee.count({ where: { tenantId: tenant.id } });
  if (empCount === 0) {
    await prisma.employee.createMany({
      data: [
        { tenantId: tenant.id, code: "EMP-001", name: "Suresh Babu", phone: "+91981112233", role: "site_engineer", stateCode: "KA", basicMonthlyPaise: 4_000_000n, hraMonthlyPaise: 2_000_000n, specialMonthlyPaise: 2_000_000n },
        { tenantId: tenant.id, code: "EMP-002", name: "Priya Sharma", phone: "+91982223344", role: "sales_executive", stateCode: "KA", basicMonthlyPaise: 3_000_000n, hraMonthlyPaise: 1_500_000n, specialMonthlyPaise: 2_500_000n },
        { tenantId: tenant.id, code: "EMP-003", name: "Kiran Kumar", phone: "+91983334455", role: "site_engineer", stateCode: "KA", basicMonthlyPaise: 3_500_000n, hraMonthlyPaise: 1_750_000n, specialMonthlyPaise: 1_750_000n },
      ],
    });
  }

  // Construction: activities + milestones
  const actCount = await prisma.constructionActivity.count({ where: { projectId: project.id } });
  if (actCount === 0) {
    await prisma.constructionActivity.createMany({
      data: [
        { tenantId: tenant.id, projectId: project.id, code: "mobilisation", name: "Mobilisation", durationDays: 30, deps: [] },
        { tenantId: tenant.id, projectId: project.id, code: "excavation", name: "Excavation", durationDays: 45, deps: ["mobilisation"] },
        { tenantId: tenant.id, projectId: project.id, code: "foundation", name: "Foundation", durationDays: 90, deps: ["excavation"] },
        { tenantId: tenant.id, projectId: project.id, code: "plinth", name: "Plinth", durationDays: 25, deps: ["foundation"] },
        { tenantId: tenant.id, projectId: project.id, code: "structure", name: "Structure RCC", durationDays: 252, deps: ["plinth"] },
      ],
    });
  }
  const milestoneCount = await prisma.milestone.count({ where: { projectId: project.id } });
  if (milestoneCount === 0) {
    await prisma.milestone.createMany({
      data: [
        { tenantId: tenant.id, projectId: project.id, key: "plinth", label: "Plinth complete", state: "certified", certifiedAt: new Date("2026-06-15") },
        { tenantId: tenant.id, projectId: project.id, key: "slab_3", label: "3rd slab", state: "pending" },
      ],
    });
  }

  const approvalCount = await prisma.approvalDoc.count({ where: { projectId: project.id } });
  if (approvalCount === 0) {
    await prisma.approvalDoc.createMany({
      data: [
        { tenantId: tenant.id, projectId: project.id, kind: "sanctioned_plan", ref: "BBMP/VRD/2024/441", expiresAt: new Date("2028-03-31") },
        { tenantId: tenant.id, projectId: project.id, kind: "fire_noc", ref: "KSFES/NOC/2025/1182", expiresAt: new Date("2026-10-15") },
        { tenantId: tenant.id, projectId: project.id, kind: "environmental", ref: "SEIAA/KA/2024/77" },
      ],
    });
  }
  const ncrCount = await prisma.nonConformanceReport.count({ where: { projectId: project.id } });
  if (ncrCount === 0) {
    await prisma.nonConformanceReport.create({
      data: {
        tenantId: tenant.id, projectId: project.id, ncrNo: "NCR-2026-004",
        description: "Honeycombing at Tower 1 column C12 after 3rd pour",
        severity: "major", status: "open",
      },
    });
  }
  const pourCount = await prisma.pourCard.count({ where: { projectId: project.id } });
  if (pourCount === 0) {
    await prisma.pourCard.create({
      data: {
        tenantId: tenant.id, projectId: project.id, pourNo: "PCRD-T1-S4",
        locationElement: "Tower 1 slab 4", concreteGrade: "M30", targetVolumeCum: 42.5,
        rebarCleared: true, shutterCleared: true, mepCleared: false, qcCleared: false, status: "pending",
      },
    });
  }

  // Procurement: material stock + PO
  const stockCount = await prisma.materialStock.count({ where: { projectId: project.id } });
  if (stockCount === 0) {
    await prisma.materialStock.createMany({
      data: [
        { tenantId: tenant.id, projectId: project.id, materialId: "cement-opc53", materialName: "OPC 53 Cement", unit: "bag", stockQty: 850, avgDailyConsumption: 60, inboundPoQty: 0, leadTimeDays: 7, safetyDays: 3 },
        { tenantId: tenant.id, projectId: project.id, materialId: "tmt-12mm", materialName: "TMT 12mm", unit: "kg", stockQty: 12_000, avgDailyConsumption: 400, inboundPoQty: 5_000, leadTimeDays: 10, safetyDays: 5 },
      ],
    });
  }
  const poExists = await prisma.purchaseOrder.findFirst({ where: { tenantId: tenant.id, poNo: "PO-0001" } });
  if (!poExists) {
    await prisma.purchaseOrder.create({
      data: {
        tenantId: tenant.id, projectId: project.id, poNo: "PO-0001",
        status: "received", totalPaise: 24_500_000_00n,
        promisedDate: new Date("2026-08-15"), receivedDate: new Date("2026-08-14"), receivedInFull: true,
      },
    });
  }

  // Compliance: statutory filings
  const filingCount = await prisma.statutoryFiling.count({ where: { tenantId: tenant.id } });
  if (filingCount === 0) {
    await prisma.statutoryFiling.createMany({
      data: [
        { tenantId: tenant.id, kind: "gst", period: "2026-08", dueOn: new Date("2026-09-11"), status: "filed", ownerRole: "finance_manager", filedAt: new Date("2026-09-10") },
        { tenantId: tenant.id, kind: "tds", period: "2026-08", dueOn: new Date("2026-09-07"), status: "open", ownerRole: "finance_manager" },
        { tenantId: tenant.id, kind: "pf", period: "2026-08", dueOn: new Date("2026-09-15"), status: "open", ownerRole: "hr_manager" },
      ],
    });
  }

  await seedFinanceBooks(prisma, tenant.id, entityId1, project.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
