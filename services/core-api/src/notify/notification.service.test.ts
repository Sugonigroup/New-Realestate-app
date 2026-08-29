import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationService } from "./notification.service.js";
import type { NotificationPort, ProviderResult } from "./port.js";

function fakePrisma(opts?: { template?: Record<string, unknown>; consents?: Array<Record<string, unknown>> }) {
  const logs: Array<Record<string, unknown>> = [];
  return {
    prisma: {
      consentLedger: { findMany: vi.fn(async () => opts?.consents ?? []) },
      notificationTemplate: {
        // honors the approval-status filter the service must apply (HSM contract)
        findFirst: vi.fn(async (q: { where?: { approvalStatus?: { in?: string[] } } }) => {
          const t = (opts?.template ?? {
            key: "demand_due",
            channel: "whatsapp",
            body: "Hi {{name}}, ₹{{amount}} due on {{due}}. Pay: {{link}}",
            category: "utility",
            subject: null,
            approvalStatus: "approved",
            version: 2,
          }) as Record<string, unknown>;
          const allowed = q?.where?.approvalStatus?.in ?? [];
          return allowed.includes(t.approvalStatus as string) ? t : null;
        }),
      },
      messageLog: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, id: `ml-${logs.length + 1}` };
          logs.push(row);
          return row;
        }),
      },
      journey: {
        findUnique: vi.fn(async () => ({
          id: "j-1",
          active: true,
          definition: {
            steps: [{ type: "send", channel: "whatsapp", templateKey: "demand_due" }],
          },
        })),
      },
      journeyState: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "js-1", ...data })) },
    } as never as PrismaLike,
    logs,
  };
}

interface PrismaLike {
  consentLedger: { findMany: (q: unknown) => Promise<unknown[]> };
  notificationTemplate: { findFirst: (q: unknown) => Promise<unknown> };
  messageLog: { create: (q: unknown) => Promise<Record<string, unknown>> };
  journey: { findUnique: (q: unknown) => Promise<unknown> };
  journeyState: { create: (q: unknown) => Promise<Record<string, unknown>> };
}

function fakeAdapter(result?: Partial<ProviderResult>) {
  const sent: unknown[] = [];
  return {
    adapter: {
      name: "fake",
      supports: ["whatsapp", "email", "sms"],
      send: vi.fn(async (msg: unknown) => {
        sent.push(msg);
        return { providerId: "p-1", status: "sent", ...result };
      }),
    } as NotificationPort & { send: ReturnType<typeof vi.fn> },
    sent,
  };
}

const base = {
  tenantId: "t-1",
  channel: "whatsapp" as const,
  templateKey: "demand_due",
  toRef: "+919876543210",
  toAddress: "+919876543210",
  purpose: "transactional" as const,
  vars: { name: "Ravi", amount: "45,000", due: "05 Sep", link: "https://pay/b1" },
};

// Deterministic clock: 04:00 UTC = 09:30 IST (outside quiet hours).
// Quiet-hour behavior is tested explicitly with a 16:00 UTC freeze.
describe("NotificationService (WP-0H)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-01T04:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends through the adapter and logs status sent", async () => {
    const { prisma, logs } = fakePrisma();
    const { adapter, sent } = fakeAdapter();
    const svc = new NotificationService(prisma as never, adapter);
    const out = await svc.send(base);
    expect(out.status).toBe("sent");
    expect(sent).toHaveLength(1);
    expect((sent[0] as { body: string }).body).toContain("Ravi");
    expect(logs[0]).toMatchObject({ status: "sent", channel: "whatsapp" });
  });

  it("suppresses promotional sends without consent (DPDP)", async () => {
    const { prisma, logs } = fakePrisma();
    const { adapter } = fakeAdapter();
    const svc = new NotificationService(prisma as never, adapter);
    const out = await svc.send({ ...base, purpose: "promotional" });
    expect(out.status).toBe("suppressed");
    expect(adapter.send).not.toHaveBeenCalled();
    expect(logs[0]).toMatchObject({ status: "suppressed", failureReason: "consent: no-consent" });
  });

  it("suppresses after STOP even for transactional sends", async () => {
    const { prisma, logs } = fakePrisma({
      consents: [{ channel: "whatsapp", purpose: "transactional", grantedAt: new Date(), revokedAt: new Date() }],
    });
    const { adapter } = fakeAdapter();
    const svc = new NotificationService(prisma as never, adapter);
    const out = await svc.send(base);
    expect(out.status).toBe("suppressed");
    expect(adapter.send).not.toHaveBeenCalled();
    expect(logs[0]?.failureReason).toBe("consent: revoked");
  });

  it("defers non-S0 during quiet hours instead of sending; S0 goes out", async () => {
    const { prisma, logs } = fakePrisma();
    const { adapter } = fakeAdapter();
    const svc = new NotificationService(prisma as never, adapter);

    vi.setSystemTime(new Date("2025-06-01T16:00:00Z")); // 21:30 IST
    const out = await svc.send({ ...base, severity: "S2" });
    expect(out.status).toBe("deferred");
    expect(adapter.send).not.toHaveBeenCalled();
    expect(logs[0]?.deferUntil).toBeDefined();

    const s0 = await svc.send({ ...base, severity: "S0" });
    expect(s0.status).toBe("sent");
    expect(adapter.send).toHaveBeenCalledTimes(1);
  });

  it("unapproved WhatsApp HSM templates are not sendable", async () => {
    const { prisma } = fakePrisma({
      template: { key: "x", channel: "whatsapp", body: "hi", approvalStatus: "pending", category: "utility", subject: null },
    });
    const { adapter } = fakeAdapter();
    const svc = new NotificationService(prisma as never, adapter);
    await expect(svc.send(base)).rejects.toThrow(/not found\/approved/);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it("journey trigger sends the first step and records run state", async () => {
    const { prisma } = fakePrisma();
    const { adapter } = fakeAdapter();
    const svc = new NotificationService(prisma as never, adapter);
    const run = await svc.triggerJourney("t-1", "demand_journey", "+919876543210", {
      ...base.vars,
      toAddress: "+919876543210",
    } as Record<string, string>);
    expect(run.sends).toBe(1);
    expect(run.status).toBe("completed");
    expect(adapter.send).toHaveBeenCalledTimes(1);
  });
});
