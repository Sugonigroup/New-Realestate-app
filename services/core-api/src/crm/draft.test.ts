import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { CrmDraftService } from "./draft.service.js";
import { CrmCommsService } from "./comms.service.js";
import { LlmGateway, maskPii } from "../ai/gateway.js";

type Row = Record<string, unknown> & { id: string };

function fakePrisma() {
  const db = {
    leads: [] as Row[],
    interactions: [] as Row[],
    drafts: [] as Row[],
    comms: [] as Row[],
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
    lead: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.leads.find(match(where));
        return row ? { ...row } : null;
      }),
    },
    interaction: {
      findMany: vi.fn(async ({ where }: any) => db.interactions.filter(match(where)).map((i) => ({ ...i }))),
    },
    crmDraft: {
      findFirst: vi.fn(async ({ where }: any) => {
        const row = db.drafts.find(match(where));
        return row ? { ...row } : null;
      }),
      findMany: vi.fn(async ({ where }: any) => db.drafts.filter(match(where)).map((d) => ({ ...d }))),
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("d"), ...data }; db.drafts.push(r); return r; }),
      update: vi.fn(async ({ where, data }: any) => {
        const r = db.drafts.find((x) => x.id === where.id)!;
        Object.assign(r, data);
        return { ...r };
      }),
    },
    communication: {
      create: vi.fn(async ({ data }: any) => { const r = { id: nid("m"), ...data }; db.comms.push(r); return { ...r }; }),
    },
    relationshipPerson: {
      findFirst: vi.fn(async ({ where }: any) => {
        if (where.leadId) {
          const lead = db.leads.find((l) => l.id === where.leadId && l.tenantId === where.tenantId);
          return lead ? { id: `p-${lead.id}`, leadId: lead.id, tenantId: where.tenantId } : null;
        }
        const row = db.leads.find(match(where));
        return row ? { ...row } : null;
      }),
    },
    consentLedger: {
      findFirst: vi.fn(async () => ({ grantedAt: new Date(), revokedAt: null })),
    },
  };

  return { prisma, db };
}

const T = "t-1";

describe("CrmDraftService (CRM-112/113)", () => {
  let f: ReturnType<typeof fakePrisma>;
  let svc: CrmDraftService;
  let gateway: LlmGateway;

  beforeEach(() => {
    f = fakePrisma();
    gateway = new LlmGateway(); // deterministic shadow provider
    // Wire comms against the same fake (consent auto-granted)
    const comms = Object.create(CrmCommsService.prototype) as CrmCommsService;
    Object.assign(comms, { prisma: f.prisma });
    (comms as unknown as { consentFor: () => Promise<string> }).consentFor = async () => "granted";
    svc = new CrmDraftService(f.prisma as never, comms, gateway);
  });

  it("creates a draft through the gateway with model + promptHash + cost metadata", async () => {
    f.db.leads.push({ id: "l1", tenantId: T, fullName: "Rajesh", status: "qualified", score: 65, source: "meta_ads" });
    f.db.interactions.push({ id: "i1", tenantId: T, leadId: "l1", type: "call", disposition: "interested" });

    const draft = await svc.draftCommunication(T, { leadId: "l1", channel: "whatsapp" as const, intent: "follow_up" });
    expect(draft.status).toBe("draft");
    expect(draft.model).toBe("deterministic-shadow-v1");
    expect(draft.promptHash).toBeTruthy();
    expect(draft.costPaise).toBe(0n); // shadow provider is free

    await expect(svc.draftCommunication(T, { leadId: "nope", channel: "email" as const, intent: "follow_up" }))
      .rejects.toThrow(NotFoundException);
  });

  it("approve-and-send routes through the consent gate and links the communication", async () => {
    f.db.leads.push({ id: "l1", tenantId: T, fullName: "A", status: "new", score: 10, source: "portal" });
    const draft = await svc.draftCommunication(T, { leadId: "l1", channel: "whatsapp" as const, intent: "visit_reminder" });

    const res = await svc.approveAndSend(T, draft.id, "crm-head");
    expect(res.approved).toBe(true);
    expect(f.db.drafts[0]!.status).toBe("approved");
    expect(f.db.drafts[0]!.approvedBy).toBe("crm-head");
    expect(f.db.drafts[0]!.sentCommId).toBeTruthy();
    expect(f.db.comms).toHaveLength(1);

    // Already-approved draft cannot be sent twice
    await expect(svc.approveAndSend(T, draft.id, "x")).rejects.toThrow(ConflictException);
  });

  it("discard flow: only draft-status rows can be discarded", async () => {
    f.db.leads.push({ id: "l2", tenantId: T, fullName: "B", status: "new", score: 5, source: "ivr" });
    const draft = await svc.draftCommunication(T, { leadId: "l2", channel: "sms" as const, intent: "reactivation" });

    const discarded = await svc.discardDraft(T, draft.id);
    expect(discarded.status).toBe("discarded");
    await expect(svc.approveAndSend(T, draft.id, "x")).rejects.toThrow(ConflictException);
    await expect(svc.discardDraft(T, draft.id)).rejects.toThrow(ConflictException);
  });

  it("maskPii strips Aadhaar/PAN/account numbers before drafting context leaves", () => {
    const masked = maskPii("Aadhaar 1234 5678 9012 PAN ABCDE1234F acct 123456789012345");
    expect(masked).toContain("[AADHAAR_MASKED]");
    expect(masked).toContain("[PAN_MASKED]");
    expect(masked).toContain("[ACCOUNT_MASKED]");
  });
});
