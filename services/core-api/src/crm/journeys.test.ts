import { describe, expect, it, vi } from "vitest";
import type { NotificationService } from "../notify/notification.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { LeadAutomationService } from "./journeys.js";

function makeFake(leads: Array<Record<string, unknown>> = []) {
  const updated: Array<Record<string, unknown>> = [];
  const registered: string[] = [];
  const triggered: Array<{ key: string; personRef: string }> = [];
  const prisma = {
    lead: {
      findMany: vi.fn(async () => leads),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        updated.push({ id: where.id, ...data });
        return { id: where.id };
      }),
    },
  };
  const notify = {
    registerJourney: vi.fn(async (_t: string, key: string) => void registered.push(key)),
    triggerJourney: vi.fn(async (_t: string, key: string, personRef: string) => {
      triggered.push({ key, personRef });
      return { runId: "r", status: "completed", sends: 1 };
    }),
  };
  return { prisma, notify, updated, registered, triggered };
}

describe("LeadAutomationService (WP-1B)", () => {
  it("registers the 5 default journeys per tenant", async () => {
    const { prisma, notify, registered } = makeFake();
    const svc = new LeadAutomationService(prisma as unknown as PrismaService, notify as unknown as NotificationService);
    const n = await svc.registerDefaultJourneys("t-1");
    expect(n).toBe(5);
    expect(registered).toEqual(["lead_ack", "warm_nurture", "visit_reminder", "no_show_recovery", "stale_reactivation"]);
  });

  it("lead.created triggers instant ack + starts the nurture journey", async () => {
    const { notify, triggered } = makeFake();
    const svc = new LeadAutomationService({ lead: { findMany: async () => [] } } as unknown as PrismaService, notify as unknown as NotificationService);
    await svc.onLeadCreated("t-1", "lead-9", { name: "Ravi" });
    expect(triggered).toEqual([
      { key: "lead_ack", personRef: "lead-9" },
      { key: "warm_nurture", personRef: "lead-9" },
    ]);
    expect(notify.triggerJourney).toHaveBeenCalledWith("t-1", "lead_ack", "lead-9", { leadId: "lead-9", name: "Ravi" });
  });

  it("nightly rescore updates only open leads", async () => {
    const { prisma, updated } = makeFake();
    prisma.lead.findMany.mockResolvedValue([
      { id: "l1", source: "partner", createdAt: new Date(), budgetPaise: null, projectId: null },
      { id: "l2", source: "portal", createdAt: new Date(), budgetPaise: null, projectId: null },
    ]);
    const svc = new LeadAutomationService(prisma as unknown as PrismaService, {
      registerJourney: vi.fn(),
      triggerJourney: vi.fn(),
    } as unknown as NotificationService);
    const out = await svc.rescoreAll("t-1");
    expect(out.rescored).toBe(2);
    expect(updated.map((u) => u.id)).toEqual(["l1", "l2"]);
    const l1 = updated.find((u) => u.id === "l1")!;
    const l2 = updated.find((u) => u.id === "l2")!;
    expect(l1.score as number).toBeGreaterThan(l2.score as number);
  });
});
