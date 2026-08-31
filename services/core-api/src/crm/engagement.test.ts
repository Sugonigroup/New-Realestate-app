import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { EngagementService } from "./engagement.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    persons: [] as Row[],
    events: [] as Row[],
    policies: [] as Row[],
    executions: [] as Row[],
  };
  let seq = 0;
  const nid = (p: string) => `${p}-${++seq}`;

  function match(where: Row) {
    return (row: Row) => Object.entries(where).every(([k, v]) => {
      if (v === undefined) return true;
      if (v && typeof v === "object" && "in" in (v as object)) return ((v as { in: unknown[] }).in).includes(row[k]);
      if (v && typeof v === "object" && "in" in (v as object) === false && "gte" in (v as object)) {
        const r = v as { gte?: Date; lte?: Date };
        const val = row[k] as Date;
        if (r.gte && val < r.gte) return false;
        if (r.lte && val > r.lte) return false;
        return true;
      }
      return row[k] === v;
    });
  }

  const prisma = {
    relationshipPerson: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.persons.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.persons.filter(match(where)).map((p) => ({ ...p }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("p"), ...data }; db.persons.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.persons.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    relationshipEvent: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.events.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where, include }: any) =>
        db.events.filter(match(where)).map((e) => ({
          ...e,
          person: include?.person ? db.persons.find((p) => p.id === e.personId) : undefined,
        })),
      ),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("e"), ...data }; db.events.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.events.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    engagementPolicy: {
      findMany: vi.fn(async ({ where }: any) => db.policies.filter(match(where)).map((p) => ({ ...p }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("pol"), ...data }; db.policies.push(r); return r; }),
    },
    engagementExecution: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.executions.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.executions.filter(match(where)).map((e) => ({ ...e }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("x"), ...data }; db.executions.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.executions.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
  };

  function addPolicy(p: Partial<Row>) {
    db.policies.push({
      id: nid("pol"), tenantId: "t-1", audience: "customers", leadDays: 7,
      allowedChannels: ["whatsapp", "email"], quietStartHour: 21, quietEndHour: 8,
      maxPerOccurrence: 1, approvalRequired: false, active: true, ...p,
    });
  }

  return { prisma, db, addPolicy };
}

const T = "t-1";

describe("EngagementService (Vishesh §28)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: EngagementService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new EngagementService(f.prisma as never);
  });

  // ── Recurring date math ─────────────────────────────────────────────────

  it("clamps 29 Feb birthdays to 28 Feb on non-leap years and keeps 29 Feb on leap years", () => {
    // From 1 Jan 2027 (non-leap): next occurrence of Feb 29 → 28 Feb 2027
    const next = svc.nextOccurrence(2, 29, new Date(Date.UTC(2027, 0, 1)));
    expect(next.getUTCMonth()).toBe(1);
    expect(next.getUTCDate()).toBe(28);
    expect(next.getUTCFullYear()).toBe(2027);

    // From 1 Jan 2028 (leap): keeps 29 Feb 2028
    const leap = svc.nextOccurrence(2, 29, new Date(Date.UTC(2028, 0, 1)));
    expect(leap.getUTCDate()).toBe(29);
    expect(leap.getUTCFullYear()).toBe(2028);

    // Past date this year rolls to next year
    const rolled = svc.nextOccurrence(1, 1, new Date(Date.UTC(2027, 5, 15))); // 15 Jun 2027
    expect(rolled.getUTCFullYear()).toBe(2028);
  });

  // ── Gate chain ──────────────────────────────────────────────────────────

  function seedPersonEvent(opts: {
    consent: string; visibility?: string; eventType?: string; month: number; day: number;
  }) {
    f.db.persons.push({
      id: "p-1", tenantId: T, personType: "customer", displayName: "Rajesh Patil",
      preferredLanguage: "mr", preferredChannel: "whatsapp", consentStatus: opts.consent,
    });
    f.db.events.push({
      id: "e-1", tenantId: T, personId: "p-1", eventType: opts.eventType ?? "BIRTHDAY",
      month: opts.month, day: opts.day, isRecurring: true,
      visibility: opts.visibility ?? "public", verified: true, active: true,
    });
  }

  it("suppresses outreach without granted consent", async () => {
    seedPersonEvent({ consent: "revoked", month: 9, day: 15 });
    f.addPolicy({ eventType: "BIRTHDAY", leadDays: 30 });

    const res = await svc.planEngagements(T, new Date(Date.UTC(2026, 7, 31))); // 31 Aug → 15 Sep within 30d
    expect(res[0]!.status).toBe("suppressed");
    expect(res[0]!.reason).toBe("consent_revoked");
    expect(f.db.executions).toHaveLength(0);
  });

  it("suppresses private-visibility events and never messages them", async () => {
    seedPersonEvent({ consent: "granted", visibility: "private", month: 9, day: 15 });
    f.addPolicy({ eventType: "BIRTHDAY", leadDays: 30 });

    const res = await svc.planEngagements(T, new Date(Date.UTC(2026, 7, 31)));
    expect(res[0]!.reason).toBe("private_event");
  });

  it("suppresses sends inside quiet hours window", async () => {
    seedPersonEvent({ consent: "granted", month: 9, day: 15 });
    f.addPolicy({ eventType: "BIRTHDAY", leadDays: 30, quietStartHour: 9, quietEndHour: 17 });

    // plannedHour 11 falls inside 09:00–17:00 quiet window
    const res = await svc.planEngagements(T, new Date(Date.UTC(2026, 7, 31)), 11);
    expect(res[0]!.reason).toBe("quiet_hours");
  });

  it("plans approved execution inside policy window and respects frequency cap on re-plan", async () => {
    seedPersonEvent({ consent: "granted", month: 9, day: 15 });
    f.addPolicy({ eventType: "BIRTHDAY", leadDays: 30, approvalRequired: false });

    const res = await svc.planEngagements(T, new Date(Date.UTC(2026, 7, 31)), 11);
    expect(res[0]!.status).toBe("approved");
    expect(f.db.executions[0]!.channel).toBe("whatsapp");
    expect(f.db.executions[0]!.occurrenceKey).toBe("BIRTHDAY:2026-09-15");

    // Re-planning same occurrence is suppressed by the frequency cap
    const again = await svc.planEngagements(T, new Date(Date.UTC(2026, 7, 31)), 11);
    expect(again[0]!.status).toBe("suppressed");
    expect(again[0]!.reason).toBe("frequency_cap");
  });

  it("prevents duplicate same-day messages: birthday + festival on the same day sends once", async () => {
    seedPersonEvent({ consent: "granted", month: 10, day: 20, eventType: "BIRTHDAY" });
    f.db.events.push({
      id: "e-2", tenantId: T, personId: "p-1", eventType: "FESTIVAL",
      month: 10, day: 20, isRecurring: true, visibility: "public", verified: true, active: true,
    });
    f.addPolicy({ eventType: "BIRTHDAY", leadDays: 30 });
    f.addPolicy({ eventType: "FESTIVAL", leadDays: 30 });

    const res = await svc.planEngagements(T, new Date(Date.UTC(2026, 8, 25)), 11);
    const birthday = res.find((r) => r.eventId === "e-1");
    const festival = res.find((r) => r.eventId === "e-2");
    expect(birthday!.status).toBe("approved");
    expect(festival!.status).toBe("suppressed");
    expect(festival!.reason).toBe("duplicate_day_message");
    expect(f.db.executions).toHaveLength(1); // exactly one relationship message
  });

  it("parks approval-required policies at planned and enforces approve → execute order", async () => {
    seedPersonEvent({ consent: "granted", month: 9, day: 15 });
    f.addPolicy({ eventType: "BIRTHDAY", leadDays: 30, approvalRequired: true });

    const res = await svc.planEngagements(T, new Date(Date.UTC(2026, 7, 31)), 11);
    expect(res[0]!.status).toBe("planned");

    const execId = f.db.executions[0]!.id;
    // Cannot send without approval
    await expect(svc.executeExecution(T, execId)).rejects.toThrow(ConflictException);

    await svc.approveExecution(T, execId, "crm-head");
    const sent = await svc.executeExecution(T, execId);
    expect(sent.status).toBe("sent");
    expect(sent.sentAt).toBeTruthy();
  });

  it("falls back to first allowed channel when person preference is not permitted", async () => {
    seedPersonEvent({ consent: "granted", month: 9, day: 15 });
    f.db.persons[0]!.preferredChannel = "sms";
    f.addPolicy({ eventType: "BIRTHDAY", leadDays: 30, allowedChannels: ["whatsapp", "email"] });

    await svc.planEngagements(T, new Date(Date.UTC(2026, 7, 31)), 11);
    expect(f.db.executions[0]!.channel).toBe("whatsapp");
  });

  it("rejects invalid event types and dates at registration", async () => {
    f.db.persons.push({ id: "p-2", tenantId: T, personType: "lead", displayName: "X", consentStatus: "granted" });
    await expect(svc.addEvent(T, "p-2", { eventType: "SOMETHING_ODD", month: 5, day: 4 })).rejects.toThrow(BadRequestException);
    await expect(svc.addEvent(T, "p-2", { eventType: "BIRTHDAY", month: 13, day: 40 })).rejects.toThrow(BadRequestException);
    await expect(svc.addEvent(T, "nope", { eventType: "BIRTHDAY", month: 5, day: 4 })).rejects.toThrow(NotFoundException);
  });
});
