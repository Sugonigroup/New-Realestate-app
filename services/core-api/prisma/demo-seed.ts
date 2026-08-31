/**
 * Demo data seed — populates CRM, engagement, pipeline, visits and tasks
 * for the running demo tenant. Idempotent: skips if leads already exist.
 * Run: DATABASE_URL=... pnpm exec tsx prisma/demo-seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DAY = 86_400_000;
const now = new Date();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: "shree-developers" } });
  if (!tenant) throw new Error("run the base seed first (pnpm db:seed)");
  const leadCount = await prisma.lead.count({ where: { tenantId: tenant.id } });
  if (leadCount > 0) {
    console.log(`demo data already present (${leadCount} leads) — skipping`);
    return;
  }

  const admin = await prisma.user.findFirst({ where: { tenantId: tenant.id, email: "admin@shree.example" } });
  if (!admin) throw new Error("admin user missing");
  const rep1 = admin.id;

  const project = await prisma.project.findFirst({ where: { tenantId: tenant.id } });
  const units = await prisma.unit.findMany({ where: { tenantId: tenant.id, state: "available" }, take: 4 });

  const leadRows = [
    { fullName: "Rajesh Patil", phone: "+919820011001", source: "meta_ads", status: "qualified", score: 85, budget: 9_500_000_00n, days: 2 },
    { fullName: "Priya Sharma", phone: "+919820011002", source: "google_ads", status: "visited", score: 78, budget: 8_200_000_00n, days: 5 },
    { fullName: "Amit Desai", phone: "+919820011003", source: "portal", status: "contacted", score: 62, budget: 7_000_000_00n, days: 1 },
    { fullName: "Sneha Kulkarni", phone: "+919820011004", source: "walkin", status: "negotiation", score: 91, budget: 12_000_000_00n, days: 9 },
    { fullName: "Vikram Rao", phone: "+919820011005", source: "partner", status: "new", score: 45, budget: null, days: 0 },
    { fullName: "Neha Joshi", phone: "+919820011006", source: "website", status: "qualified", score: 74, budget: 8_800_000_00n, days: 4 },
    {fullName: "Karan Mehta", phone: "+919820011007", source: "meta_ads", status: "contacted", score: 58, budget: 6_500_000_00n, days: 21 },
    { fullName: "Divya Iyer", phone: "+919820011008", source: "google_ads", status: "visited", score: 80, budget: 9_000_000_00n, days: 7 },
    { fullName: "Suresh Nair", phone: "+919820011009", source: "ivr", status: "new", score: 38, budget: null, days: 1 },
    { fullName: "Anita Fernandes", phone: "+919820011010", source: "portal", status: "booking", score: 95, budget: 13_500_000_00n, days: 12 },
  ];

  let first = true;
  const leads: Array<{ id: string; fullName: string; status: string }> = [];
  for (const l of leadRows) {
    const createdAt = new Date(now.getTime() - l.days * DAY - 3 * 3600_000);
    const lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        source: l.source,
        sourceRef: `demo-${l.phone}`,
        projectId: project?.id,
        fullName: l.fullName,
        phone: l.phone,
        email: `${l.fullName.split(" ")[0]!.toLowerCase()}@example.com`,
        budgetPaise: l.budget,
        segment: "residential",
        status: l.status,
        score: l.score,
        assignedUserId: rep1,
        slaRespondBy: first ? new Date(now.getTime() + 3600_000) : new Date(createdAt.getTime() + 4 * 3600_000),
        firstRespondedAt: l.status !== "new" ? new Date(createdAt.getTime() + 2 * 3600_000) : null,
        createdAt,
      },
    });
    first = false;
    leads.push({ id: lead.id, fullName: l.fullName, status: l.status });

    if (l.status !== "new") {
      await prisma.interaction.create({
        data: { tenantId: tenant.id, leadId: lead.id, type: "call", disposition: "interested", notes: "Intro call", byUserId: rep1, createdAt: new Date(createdAt.getTime() + 2 * 3600_000) },
      });
    }
    if (["visited", "negotiation", "booking"].includes(l.status)) {
      await prisma.interaction.create({
        data: { tenantId: tenant.id, leadId: lead.id, type: "visit", disposition: "site_tour", notes: "Tower A walkthrough", byUserId: rep1, createdAt: new Date(createdAt.getTime() + 2 * DAY) },
      });
    }
  }

  // Interactions pattern for inactive-lead recommendation demo
  const inactive = leads.find((l) => l.fullName === "Karan Mehta")!;
  await prisma.interaction.create({
    data: { tenantId: tenant.id, leadId: inactive.id, type: "whatsapp", disposition: "no_reply", byUserId: rep1, createdAt: new Date(now.getTime() - 18 * DAY) },
  });

  // Opportunities
  const qualifiedLead = leads.find((l) => l.fullName === "Sneha Kulkarni")!;
  const bookingLead = leads.find((l) => l.fullName === "Anita Fernandes")!;
  const visitedLead = leads.find((l) => l.fullName === "Priya Sharma")!;
  const oppDefs = [
    { oppNo: "OPP-2026-001", leadId: qualifiedLead.id, stage: "offer", p: 70, value: 12_000_000_00n, stalledDays: 12 },
    { oppNo: "OPP-2026-002", leadId: bookingLead.id, stage: "booking_pending", p: 95, value: 13_500_000_00n, stalledDays: null },
    { oppNo: "OPP-2026-003", leadId: visitedLead.id, stage: "unit_interest", p: 40, value: 8_200_000_00n, stalledDays: null },
  ];
  for (const o of oppDefs) {
    const opp = await prisma.opportunity.create({
      data: {
        tenantId: tenant.id, oppNo: o.oppNo, leadId: o.leadId, projectId: project?.id ?? "",
        stage: o.stage, probabilityPct: o.p, expectedValuePaise: o.value,
        financing: "loan", assignedUserId: rep1,
        stalledSince: o.stalledDays ? new Date(now.getTime() - o.stalledDays * DAY) : null,
      },
    });
    if (units[0] && o.oppNo !== "OPP-2026-001") {
      await prisma.opportunityUnitInterest.create({
        data: { tenantId: tenant.id, opportunityId: opp.id, unitId: units[0]!.id, configType: "3bhk", status: "active" },
      });
    }
  }

  // Site visits
  await prisma.siteVisit.create({
    data: { tenantId: tenant.id, leadId: visitedLead.id, projectId: project?.id, scheduledAt: new Date(now.getTime() + 2 * DAY), status: "confirmed", confirmedAt: now },
  });
  await prisma.siteVisit.create({
    data: { tenantId: tenant.id, leadId: qualifiedLead.id, projectId: project?.id, scheduledAt: new Date(now.getTime() - 3 * DAY), status: "done", outcome: "interested", feedback: "Likes east-facing", confirmedAt: new Date(now.getTime() - 4 * DAY), completedAt: new Date(now.getTime() - 3 * DAY) },
  });

  // Vishesh engagement: persons, today/this-week events, policy
  await prisma.engagementPolicy.create({
    data: { tenantId: tenant.id, eventType: "BIRTHDAY", audience: "customers", leadDays: 7, allowedChannels: ["whatsapp", "email"], quietStartHour: 21, quietEndHour: 8, maxPerOccurrence: 1, approvalRequired: true, active: true },
  });
  await prisma.engagementPolicy.create({
    data: { tenantId: tenant.id, eventType: "FESTIVAL", audience: "customers", leadDays: 3, allowedChannels: ["whatsapp"], quietStartHour: 21, quietEndHour: 8, maxPerOccurrence: 1, approvalRequired: false, active: true },
  });

  const people = [
    { name: "Rajesh Patil", type: "customer", month: now.getUTCMonth() + 1, day: now.getUTCDate(), eventType: "BIRTHDAY", lang: "mr" }, // today
    { name: "Priya Sharma", type: "customer", eventType: "BIRTHDAY", offsetDays: 3, lang: "en" },
    { name: "Anita Fernandes", type: "customer", eventType: "WEDDING_ANNIVERSARY", offsetDays: 5, lang: "en" },
    { name: "Suresh Nair", type: "lead", eventType: "BIRTHDAY", offsetDays: 2, lang: "en" },
  ];
  for (const p of people) {
    const person = await prisma.relationshipPerson.create({
      data: { tenantId: tenant.id, personType: p.type, displayName: p.name, preferredLanguage: p.lang, preferredChannel: "whatsapp", consentStatus: "granted", city: "Pune", state: "MH" },
    });
    let month = p.month, day = p.day;
    if (p.offsetDays !== undefined) {
      const d = new Date(now.getTime() + p.offsetDays * DAY);
      month = d.getUTCMonth() + 1;
      day = d.getUTCDate();
    }
    await prisma.relationshipEvent.create({
      data: { tenantId: tenant.id, personId: person.id, eventType: p.eventType, month, day, isRecurring: true, visibility: "public", verified: true, active: true },
    });
  }
  // one revoked-consent person (suppression demo)
  const supp = await prisma.relationshipPerson.create({
    data: { tenantId: tenant.id, personType: "lead", displayName: "Old Prospect", preferredChannel: "whatsapp", consentStatus: "revoked" },
  });
  await prisma.relationshipEvent.create({
    data: { tenantId: tenant.id, personId: supp.id, eventType: "FESTIVAL", month: now.getUTCMonth() + 1, day: now.getUTCDate(), isRecurring: true, active: true },
  });

  // Tasks
  await prisma.crmTask.create({ data: { tenantId: tenant.id, leadId: leads[0]!.id, title: "Share revised price sheet", dueOn: new Date(now.getTime() + DAY), assigneeId: rep1, status: "open" } });
  await prisma.crmTask.create({ data: { tenantId: tenant.id, leadId: bookingLead.id, title: "Collect booking KYC documents", dueOn: new Date(now.getTime() + 2 * DAY), assigneeId: rep1, status: "open" } });

  console.log(`demo seed: ${leads.length} leads, 3 opportunities, 2 visits, 4 engagement persons, 2 tasks`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
