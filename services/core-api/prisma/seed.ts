/**
 * Phase 0 seed — reference tenant per `phases/phase-0-foundations.md` (WP-0C):
 * "Shree Developers (₹500Cr demo)": 2 entities, 3 verticals, 2 projects, 20 units,
 * role templates from @buildos/permissions, one super-admin user.
 */
import { PrismaClient } from "@prisma/client";
import { ROLE_TEMPLATES } from "@buildos/permissions";

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
      data: { tenantId: tenant.id, email: "admin@shree.example", fullName: "Demo Admin", status: "active" },
    });
    await prisma.userRole.create({
      data: { tenantId: tenant.id, userId: u.id, roleId: superAdminRole!.id, scope: "ALL" },
    });
  }

  await prisma.numberSeries.upsert({
    where: { tenantId_entityId_seriesKey: { tenantId: tenant.id, entityId: entityId1, seriesKey: "receipt" } },
    update: {},
    create: { tenantId: tenant.id, entityId: entityId1, seriesKey: "receipt", prefix: "RCPT", gapless: true },
  });

  console.log("Seed complete: tenant=shree-developers, 2 entities, 3 verticals, 2 projects, 20 units, roles+admin.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
