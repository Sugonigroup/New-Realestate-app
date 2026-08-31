import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CrmCommsService } from "./comms.service.js";
import { CrmAnalyticsService } from "./analytics.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    persons: [] as Row[],
    leads: [] as Row[],
    consents: [] as Row[],
    comms: [] as Row[],
    opps: [] as Row[],
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
    relationshipPerson: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.persons.find(match(where));
        return row ? { ...row } : null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.persons.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    lead: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.leads.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.leads.filter(match(where)).map((l) => ({ ...l }))),
    },
    consentLedger: {
      create: vi.fn(async ({ data }: any) => {
        // strictly increasing timestamps so "latest entry" ordering is deterministic
        const r = { id: nid("c"), createdAt: new Date(Date.now() + db.consents.length), ...data };
        db.consents.push(r);
        return r;
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let res = db.consents.filter(match(where));
        if (orderBy?.createdAt === "desc") res.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
        return res[0] ? { ...res[0] } : null;
      }),
    },
    communication: {
      create: vi.fn(async ({ data }: any) => {
        const r = { id: nid("m"), createdAt: new Date(Date.now() + db.comms.length), ...data };
        db.comms.push(r);
        return { ...r };
      }),
      findFirst: vi.fn(async ({ where, orderBy }: any) => {
        let res = db.comms.filter(match(where));
        if (orderBy?.createdAt === "desc") res.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime());
        return res[0] ? { ...res[0] } : null;
      }),
      findMany: vi.fn(async ({ where, orderBy }: any) => {
        let res = db.comms.filter(match(where)).map((c) => ({ ...c }));
        if (orderBy?.createdAt === "asc") res.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
        return res;
      }),
    },
    opportunity: {
      findMany: vi.fn(async ({ where }: any) => db.opps.filter(match(where)).map((o) => ({ ...o }))),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("CrmCommsService (CRM-2) & CrmAnalyticsService (CRM-4)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let comms: CrmCommsService;
  let analytics: CrmAnalyticsService;

  beforeEach(() => {
    f = fakePrisma();
    comms = new CrmCommsService(f.prisma as never);
    analytics = new CrmAnalyticsService(f.prisma as never);
  });

  // ── Consent + send gate ─────────────────────────────────────────────────

  it("blocks outbound without granted consent but records the blocked attempt for audit", async () => {
    f.db.persons.push({ id: "p-1", tenantId: T, leadId: "lead-1", displayName: "A", consentStatus: "unknown" });

    const res = await comms.send(T, {
      personId: "p-1", channel: "whatsapp" as const, body: "Hi",
    });
    expect(res.deliveryStatus).toBe("failed");
    expect(res.suppressedReason).toBe("consent_unknown");
    expect(f.db.comms).toHaveLength(1); // audit trail kept
  });

  it("sends after consent granted via ledger, and a later revocation blocks again", async () => {
    f.db.persons.push({ id: "p-1", tenantId: T, leadId: "lead-1", displayName: "A", consentStatus: "granted" });
    await comms.recordConsent(T, { personId: "p-1", channel: "whatsapp" as const, status: "granted", source: "web_form" });

    const sent = await comms.send(T, { personId: "p-1", channel: "whatsapp" as const, body: "Hello" });
    expect(sent.deliveryStatus).toBe("sent");
    expect(sent.providerMessageId).toBeTruthy();

    // Revoke → next send blocked
    await comms.recordConsent(T, { personId: "p-1", channel: "whatsapp" as const, status: "revoked", source: "dnd_registry" });
    const blocked = await comms.send(T, { personId: "p-1", channel: "whatsapp" as const, body: "Again" });
    expect(blocked.suppressedReason).toBe("consent_revoked");
  });

  it("resolves inbound replies to the existing outbound thread by phone identity (no duplicate threads)", async () => {
    f.db.persons.push({ id: "p-1", tenantId: T, leadId: "lead-1", displayName: "A", consentStatus: "granted" });
    f.db.leads.push({ id: "lead-1", tenantId: T, phone: "+919812345678" });

    const out1 = await comms.send(T, { personId: "p-1", channel: "whatsapp" as const, body: "Hi, interested in Tower A?" });
    const reply = await comms.receiveInbound(T, {
      channel: "whatsapp" as const, fromPhone: "+919812345678", body: "Yes, share details",
    });
    expect(reply.threadId).toBe(out1.threadId); // appended to existing thread

    const thread = await comms.thread(T, out1.threadId);
    expect(thread).toHaveLength(2);
    expect(thread[0]!.direction).toBe("outbound");
    expect(thread[1]!.direction).toBe("inbound");
  });

  // ── Analytics ───────────────────────────────────────────────────────────

  it("computes funnel with cumulative stage reach and conversion", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, status: "won" },
      { id: "l2", tenantId: T, status: "visited" },
      { id: "l3", tenantId: T, status: "contacted" },
      { id: "l4", tenantId: T, status: "new" },
    );

    const fc = await analytics.funnel(T);
    expect(fc.totalLeads).toBe(4);
    expect(fc.winPct).toBe(25);
    // cumulative: new=4, contacted=3, qualified=2 (l1,l2), visited=2, won=1
    const stages = Object.fromEntries(fc.stages.map((s) => [s.stage, s.reached]));
    expect(stages["new"]).toBe(4);
    expect(stages["contacted"]).toBe(3);
    expect(stages["qualified"]).toBe(2);
    expect(stages["won"]).toBe(1);
  });

  it("computes source analytics with lead→won conversion", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, source: "meta_ads", status: "won" },
      { id: "l2", tenantId: T, source: "meta_ads", status: "new" },
      { id: "l3", tenantId: T, source: "portal", status: "new" },
    );
    f.db.opps.push({ id: "o1", tenantId: T, leadId: "l1", stage: "won" });

    const src = await analytics.sourceAnalytics(T);
    const meta = src.find((s) => s.source === "meta_ads")!;
    expect(meta.leads).toBe(2);
    expect(meta.won).toBe(1);
    expect(meta.leadToWonPct).toBe(50);
  });

  it("computes rep analytics with SLA compliance", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, assignedUserId: "rep-1", firstRespondedAt: new Date("2026-01-01T10:00Z"), slaRespondBy: new Date("2026-01-01T12:00Z") },
      { id: "l2", tenantId: T, assignedUserId: "rep-1", firstRespondedAt: new Date("2026-01-02T15:00Z"), slaRespondBy: new Date("2026-01-02T12:00Z") },
      { id: "l3", tenantId: T, assignedUserId: "rep-2" },
    );
    f.db.opps.push({ id: "o1", tenantId: T, leadId: "l1", stage: "won", assignedUserId: "rep-1", expectedValuePaise: 50_00_000_00n });

    const reps = await analytics.repAnalytics(T);
    const r1 = reps.find((r) => r.userId === "rep-1")!;
    expect(r1.leads).toBe(2);
    expect(r1.responded).toBe(2);
    expect(r1.slaCompliancePct).toBe(50); // 1 of 2 responses within SLA
    expect(r1.wonValuePaise).toBe(50_00_000_00n);
  });
});
