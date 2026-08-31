import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { CrmConfigService } from "./config.service.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    views: [] as Row[],
    fields: [] as Row[],
    values: [] as Row[],
    leads: [] as Row[],
    logs: [] as Row[],
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
    crmSavedView: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.views.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.views.filter(match(where)).map((v) => ({ ...v }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("v"), ...data }; db.views.push(r); return r; }),
    },
    crmCustomField: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.fields.find(match(where));
        return row ? { ...row } : null;
      }),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("f"), ...data }; db.fields.push(r); return r; }),
    },
    crmCustomFieldValue: {
      upsert: vi.fn(async ({ where, create, update }: any) => {
        const k = where.tenantId_entityType_entityId_fieldKey;
        const existing = db.values.find((x) =>
          x.tenantId === k.tenantId && x.entityType === k.entityType && x.entityId === k.entityId && x.fieldKey === k.fieldKey);
        if (existing) {
          Object.assign(existing, update);
          return { ...existing };
        }
        const fresh = { id: nid("fv"), ...create };
        db.values.push(fresh);
        return fresh;
      }),
      findMany: vi.fn(async ({ where }: any) => db.values.filter(match(where)).map((v) => ({ ...v }))),
    },
    lead: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.leads.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.leads.filter(match(where)).map((l) => ({ ...l }))),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.leads.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    leadAssignmentLog: {
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("log"), ...data }; db.logs.push(r); return r; }),
    },
  };

  return { prisma, db };
}

const T = "t-1";
const NOW = new Date("2026-09-01T10:00:00Z");

describe("CrmConfigService (views, custom fields, bulk, data quality)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: CrmConfigService;

  beforeEach(() => {
    f = fakePrisma();
    svc = new CrmConfigService(f.prisma as never);
  });

  it("creates saved views with per-owner uniqueness; shared views visible to others", async () => {
    await svc.createSavedView(T, {
      name: "Mumbai Meta Leads", entityType: "lead" as const,
      filters: { city: "Mumbai", source: "meta_ads" }, ownerId: "u1", isShared: true,
    });
    await expect(svc.createSavedView(T, {
      name: "Mumbai Meta Leads", entityType: "lead" as const, filters: {}, ownerId: "u1",
    })).rejects.toThrow(ConflictException);

    // u2 sees the shared view; private views hidden
    f.db.views.push({ id: "v-priv", tenantId: T, name: "Private", entityType: "lead", filters: {}, ownerId: "u3", isShared: false });
    const visible = await svc.listViews(T, "lead", "u2");
    expect(visible.map((v) => v.name)).toEqual(["Mumbai Meta Leads"]);
  });

  it("defines typed custom fields, validates values, upserts values idempotently", async () => {
    await svc.defineField(T, {
      entityType: "lead" as const, key: "loan_preapproved", label: "Loan Pre-approved",
      fieldType: "select" as const, options: ["yes", "no", "unknown"],
    });
    await expect(svc.defineField(T, {
      entityType: "lead" as const, key: "loan_preapproved", label: "Dup", fieldType: "text" as const,
    })).rejects.toThrow(ConflictException);
    await expect(svc.defineField(T, {
      entityType: "lead" as const, key: "empty_select", label: "Bad", fieldType: "select" as const,
    })).rejects.toThrow(BadRequestException);

    await svc.setFieldValue(T, { entityType: "lead", entityId: "l1", fieldKey: "loan_preapproved", value: "yes" });
    await svc.setFieldValue(T, { entityType: "lead", entityId: "l1", fieldKey: "loan_preapproved", value: "no" }); // upsert
    expect(f.db.values).toHaveLength(1);
    expect(f.db.values[0]!.value).toBe("no");

    await expect(svc.setFieldValue(T, { entityType: "lead", entityId: "l1", fieldKey: "loan_preapproved", value: "maybe" }))
      .rejects.toThrow(BadRequestException);
    await expect(svc.setFieldValue(T, { entityType: "lead", entityId: "l1", fieldKey: "ghost", value: "x" }))
      .rejects.toThrow(NotFoundException);

    const vals = await svc.getFieldValues(T, "lead", "l1");
    expect(vals).toEqual({ loan_preapproved: "no" });
  });

  it("bulk-assigns with per-lead results; won/lost leads fail individually without aborting", async () => {
    f.db.leads.push(
      { id: "l1", tenantId: T, status: "new", assignedUserId: "rep-1" },
      { id: "l2", tenantId: T, status: "won", assignedUserId: "rep-1" },
      { id: "l3", tenantId: T, status: "contacted", assignedUserId: null },
    );

    const res = await svc.bulkAssign(T, ["l1", "l2", "l3", "l-missing"], "rep-9", "manager-1");
    expect(res.total).toBe(4);
    expect(res.assigned).toBe(2);
    expect(res.failed).toBe(2);
    expect(f.db.leads.find((l) => l.id === "l1")!.assignedUserId).toBe("rep-9");
    expect(f.db.leads.find((l) => l.id === "l2")!.assignedUserId).toBe("rep-1"); // untouched
    expect(f.db.logs.filter((l) => l.reason === "bulk")).toHaveLength(2);
  });

  it("data quality scan scores missing contact fields, duplicates, and stale leads", async () => {
    const staleDate = new Date(NOW.getTime() - 40 * 86400_000);
    f.db.leads.push(
      { id: "l1", tenantId: T, phone: "+91", budgetPaise: 1n, dedupFlag: null, status: "new", updatedAt: NOW },
      { id: "l2", tenantId: T, phone: "", budgetPaise: null, dedupFlag: "duplicate", status: "contacted", updatedAt: staleDate },
    );

    const scan = await svc.dataQualityScan(T);
    expect(scan.totalLeads).toBe(2);
    expect(scan.checks.find((c) => c.check === "unresolved_duplicates")!.count).toBe(1);
    expect(scan.checks.find((c) => c.check === "missing_budget")!.count).toBe(1);
    expect(scan.checks.find((c) => c.check === "stale_no_progress_30d")!.count).toBe(1);
    // 3 issues / 2 leads → score 0 (capped)
    expect(scan.qualityScore).toBe(0);
  });
});
