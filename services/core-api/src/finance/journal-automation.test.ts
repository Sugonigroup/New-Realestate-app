import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { JournalAutomationService } from "./journal-automation.service.js";
import { MetricsService } from "../analytics/metrics.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    templates: [] as Row[],
    rules: [] as Row[],
    metrics: [] as Row[],
    snapshots: [] as Row[],
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
    journalTemplate: {
      findFirst: vi.fn(async ({ where }: any) => db.templates.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("tpl"), ...data }; db.templates.push(r); return r; }),
    },
    recurringJournalRule: {
      findFirst: vi.fn(async ({ where }: any) => db.rules.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("rjr"), ...data }; db.rules.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.rules.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return r;
      }),
    },
    metricDefinition: {
      findFirst: vi.fn(async ({ where }: any) => db.metrics.find(match(where))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("met"), ...data }; db.metrics.push(r); return r; }),
    },
    metricSnapshot: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const key = `${where.tenantId_metricCode_period.tenantId}:${where.tenantId_metricCode_period.metricCode}:${where.tenantId_metricCode_period.period}`;
        const existing = db.snapshots.find((x) => `${x.tenantId}:${x.metricCode}:${x.period}` === key);
        if (!existing) {
          const fresh = { id: nid("sn"), ...create };
          db.snapshots.push(fresh);
          return fresh;
        }
        Object.assign(existing, update);
        return existing;
      }),
      findMany: vi.fn(async ({ where, orderBy, take }: any) => {
        let res = db.snapshots.filter(match(where));
        if (orderBy?.period === "desc") res.sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1));
        return res.slice(0, take ?? res.length);
      }),
    },
  };

  const fakeGl = {
    createJournal: vi.fn(async () => ({ journalId: "jr-rec-01" })),
    postJournal: vi.fn(async () => ({ status: "posted" })),
  };

  return { prisma, fakeGl, db };
}

const T = "t-1";

describe("Journal Automation (FIN-03) & Metric Registry (BI-01)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let journals: JournalAutomationService;
  let metrics: MetricsService;

  beforeEach(() => {
    f = fakePrisma();
    journals = new JournalAutomationService(f.prisma as never, f.fakeGl as never);
    metrics = new MetricsService(f.prisma as never);
  });

  // ── FIN-03 ──────────────────────────────────────────────────────────────

  it("runs a monthly recurring rent journal from template, filling 'amount' placeholders", async () => {
    await journals.createTemplate(T, {
      code: "SITE-RENT", name: "Monthly site office rent",
      lines: [
        { accountCode: "5000-RENT", debitPaise: "amount" as const },
        { accountCode: "2100-AP", creditPaise: "amount" as const },
      ],
    });
    await journals.createRecurringRule(T, {
      templateCode: "SITE-RENT", frequency: "monthly", dayOfMonth: 5,
      nextRunOn: new Date("2026-08-05"),
    });

    const res = await journals.runRecurring(T, "SITE-RENT", 150_000_00n, new Date("2026-08-05"));
    expect(res.voucherNo).toBe("RJ-SITE-RENT-2026-08");
    // nextRunOn advanced one month
    expect(new Date(res.nextRunOn).getMonth()).toBe(8); // September

    // Not due again until September
    await expect(journals.runRecurring(T, "SITE-RENT", 150_000_00n, new Date("2026-08-10")))
      .rejects.toThrow(BadRequestException);
  });

  it("rejects recurring rules with day-of-month outside 1-28 and duplicate templates", async () => {
    await journals.createTemplate(T, {
      code: "TPL-A", name: "A", lines: [
        { accountCode: "1000-CASH", debitPaise: "amount" as const },
        { accountCode: "4000-REV", creditPaise: "amount" as const },
      ],
    });
    await expect(journals.createRecurringRule(T, {
      templateCode: "TPL-A", frequency: "monthly", dayOfMonth: 31, nextRunOn: new Date(),
    })).rejects.toThrow(BadRequestException);

    await expect(journals.createTemplate(T, {
      code: "TPL-A", name: "Dup", lines: [
        { accountCode: "1000-CASH", debitPaise: "amount" as const },
        { accountCode: "4000-REV", creditPaise: "amount" as const },
      ],
    })).rejects.toThrow(ConflictException);
  });

  // ── BI-01 ───────────────────────────────────────────────────────────────

  it("records metric snapshots idempotently and computes trend with direction-aware tone", async () => {
    await metrics.registerMetric(T, {
      code: "collections.mtd", name: "Collections MTD", domain: "finance", unit: "paise",
    });

    await metrics.recordSnapshot(T, { code: "collections.mtd", period: "2026-08", valueNum: 100_000_00 });
    const updated = await metrics.recordSnapshot(T, { code: "collections.mtd", period: "2026-08", valueNum: 120_000_00 });
    expect(Number(updated.valueNum)).toBe(120_000_00); // upsert overwrote, not duplicated

    await metrics.recordSnapshot(T, { code: "collections.mtd", period: "2026-09", valueNum: 150_000_00 });

    const latest = await metrics.latest(T, "collections.mtd");
    expect(latest.period).toBe("2026-09");
    expect(latest.valueNum).toBe(150_000_00);
    expect(latest.deltaPct).toBe(25); // 150 vs 120
    expect(latest.tone).toBe("GOOD"); // up_is_good metric, delta positive
  });

  it("flags down_is_good metrics correctly (dso.days improving when falling)", async () => {
    await metrics.registerMetric(T, {
      code: "dso.days", name: "Days Sales Outstanding", domain: "finance", unit: "days",
      direction: "down_is_good",
    });
    await metrics.recordSnapshot(T, { code: "dso.days", period: "2026-08", valueNum: 75 });
    await metrics.recordSnapshot(T, { code: "dso.days", period: "2026-09", valueNum: 60 });

    const latest = await metrics.latest(T, "dso.days");
    expect(latest.deltaPct).toBe(-20);
    expect(latest.tone).toBe("GOOD"); // falling DSO is good
  });

  it("rejects unregistered metrics and unregistered lookups", async () => {
    await expect(metrics.recordSnapshot(T, { code: "nope", period: "2026-09", valueNum: 1 }))
      .rejects.toThrow(NotFoundException);
    await expect(metrics.latest(T, "nope")).rejects.toThrow(NotFoundException);
  });
});
