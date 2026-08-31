import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CrmOrgService } from "./org.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    orgs: [] as Row[],
    contacts: [] as Row[],
    leads: [] as Row[],
    opps: [] as Row[],
    outbox: [] as Row[],
    audit: [] as Row[],
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
    crmOrganization: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.orgs.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where, include }: any) =>
        db.orgs.filter(match(where)).map((o) => {
          const res = { ...o };
          if (include?.contacts) res.contacts = db.contacts.filter((c) => c.organizationId === o.id);
          return res;
        })),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("org"), active: true, ...data }; db.orgs.push(r); return r; }),
    },
    crmContact: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.contacts.find(match(where));
        return row ? { ...row } : null;
      }),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("c"), ...data }; db.contacts.push(r); return r; }),
    },
    lead: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.leads.find(match(where));
        return row ? { ...row, interactions: [] } : null;
      }),
      findMany: vi.fn(async ({ where, include }: any) =>
        db.leads.filter(match(where)).map((l) => {
          const res = { ...l };
          if (include?.interactions) res.interactions = (l.interactions as Row[]) ?? [];
          return res;
        })),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("l"), createdAt: new Date(), ...data }; db.leads.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.leads.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    opportunity: { findMany: vi.fn(async ({ where }: any) => db.opps.filter(match(where)).map((o) => ({ ...o }))) },
    outboxEvent: { create: vi.fn(async ({ data }: any) => { const r = { id: nid("ob"), ...data }; db.outbox.push(r); return r; }) },
    auditEvent: { create: vi.fn(async ({ data }: any) => { const r = { id: nid("au"), ...data }; db.audit.push(r); return r; }) },
  };

  return { prisma, db };
}

const T = "t-1";
const NOW = new Date("2026-09-01T10:00:00Z");
const DAY = 86_400_000;

describe("CrmOrgService (orgs, dormancy, export, partner)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: CrmOrgService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new CrmOrgService(f.prisma as never);
  });

  it("creates organizations with GSTIN validation and unique names (CRM-027)", async () => {
    const org = await svc.createOrganization(T, { name: "Acme Corp", gstin: "27AAPFU0939F1ZV", orgType: "corporate" as const, city: "Pune" });
    expect(org.name).toBe("Acme Corp");
    await expect(svc.createOrganization(T, { name: "Acme Corp" })).rejects.toThrow(ConflictException);
    await expect(svc.createOrganization(T, { name: "Bad GSTIN", gstin: "1234" })).rejects.toThrow(BadRequestException);

    await svc.addContact(T, { organizationId: org.id, fullName: "CFO Rao", phone: "+919820099001", role: "finance" as const });
    const list = await svc.listOrganizations(T);
    expect(list[0]!.contacts).toHaveLength(1);
    await expect(svc.addContact(T, { fullName: "Dup", phone: "+919820099001" })).rejects.toThrow(ConflictException);
  });

  it("dormancy sweep marks 21-day-stale contacted leads; reactivation restores them (CRM-023/024)", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, status: "contacted", dormantAt: null, createdAt: new Date(NOW.getTime() - 30 * DAY), interactions: [] },
      { id: "l2", tenantId: T, status: "qualified", dormantAt: null, createdAt: new Date(NOW.getTime() - 5 * DAY), interactions: [] },
    );
    const sweep = await svc.sweepDormant(T, NOW);
    expect(sweep.dormantCount).toBe(1); // only l1
    expect(f.db.leads.find((l) => l.id === "l1")!.status).toBe("dormant");
    expect(f.db.outbox[0]!.type).toBe("lead.dormant.v1");

    const again = await svc.sweepDormant(T, NOW);
    expect(again.dormantCount).toBe(0); // dormantAt set → idempotent

    const reactivated = await svc.reactivate(T, "l1", "sales-rep-1");
    expect(reactivated.status).toBe("contacted");
    expect(f.db.outbox.some((e) => e.type === "lead.reactivated.v1")).toBe(true);
    await expect(svc.reactivate(T, "l1", "x")).rejects.toThrow(ConflictException); // no longer dormant
    await expect(svc.reactivate(T, "nope", "x")).rejects.toThrow(NotFoundException);
  });

  it("exports leads as CSV with an audit record of filter + row count (CRM-016)", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, fullName: "A,B", phone: "+911", email: null, source: "meta_ads", status: "new", score: 50, createdAt: NOW },
      { id: "l2", tenantId: T, fullName: "B", phone: "+912", email: "b@x.com", source: "portal", status: "contacted", score: 60, createdAt: NOW },
    );
    const csv = await svc.exportLeadsCsv(T, undefined, "admin-1");
    expect(csv.split("\n")[0]).toBe("lead_id,full_name,phone,email,source,status,score,created_at");
    expect(csv).toContain('"A,B"'); // comma-containing names quoted
    expect(f.db.audit[0]!.action).toBe("crm.lead.exported");
    expect((f.db.audit[0]!.after as { rowCount: number }).rowCount).toBe(2);
  });

  it("registers partner leads with dedupe and computes partner credit (CRM-091/092)", async () => {
    const lead = await svc.registerPartnerLead(T, {
      partnerRef: "PRT-XYZ", fullName: "Chanakya", phone: "+919820088001",
      projectId: "p1", budgetPaise: 9_00_000_00n, partnerUserId: "partner-portal-user",
    });
    expect(lead.source).toBe("partner");
    expect(lead.partnerRef).toBe("PRT-XYZ");
    expect(lead.score).toBe(55);
    await expect(svc.registerPartnerLead(T, {
      partnerRef: "PRT-XYZ", fullName: "Dup", phone: "+919820088001", partnerUserId: "u",
    })).rejects.toThrow(ConflictException);

    f.db.opps.push({ id: "o1", tenantId: T, leadId: lead.id, stage: "won", expectedValuePaise: 90_00_000n });
    const credit = await svc.partnerCredit(T, "PRT-XYZ");
    expect(credit.leads).toBe(1);
    expect(credit.wonBookings).toBe(1);
    expect(credit.wonValuePaise).toBe(90_00_000n);
  });
});
