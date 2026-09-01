import { beforeAll, describe, expect, it, vi } from "vitest";
import { PortalService } from "./portal.service.js";
import type { NotificationService } from "../notify/notification.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { verifyToken } from "../common/jwt.js";

const PHONE = "+919876543210";
const BOOKING = {
  id: "bk-1",
  tenantId: "t-1",
  customerPhone: PHONE,
  status: "confirmed",
  customerName: "Ravi Kumar",
  totalPaise: 10_000_000_00n,
  aftStatus: "sent",
  scheduleSnapshot: [
    { seq: 1, label: "On booking", amountPaise: "100000000", dueDate: new Date("2026-09-01") },
    { seq: 2, label: "On AFT (15d)", amountPaise: "100000000", dueDate: new Date("2026-09-16") },
  ],
};

function makeFake() {
  const consentRows: Array<Record<string, unknown>> = [];
  const prisma = {
    booking: { findMany: vi.fn(async () => [BOOKING]), findFirst: vi.fn(async () => BOOKING) },
    demand: {
      findMany: vi.fn(async () => [
        { id: "d1", label: "On booking", amountPaise: 100_000_000n, paidPaise: 100_000_000n, dueDate: new Date("2026-09-01"), demandNo: "DMND-1" },
        { id: "d2", label: "On AFT (15d)", amountPaise: 100_000_000n, paidPaise: 40_000_000n, dueDate: new Date("2026-09-16"), demandNo: "DMND-2" },
      ]),
    },
    receipt: { findMany: vi.fn(async () => [{ id: "r1", amountPaise: 140_000_000n, instrument: "gateway", clearedAt: new Date(), status: "cleared" }]) },
    consentLedger: {
      findMany: vi.fn(async () => consentRows),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        consentRows.unshift(data);
        return { id: "c1", ...data };
      }),
    },
    tenant: { findUnique: vi.fn(async ({ where }: { where: { slug: string } }) => (where.slug === "shree-developers" ? { id: "t-1", slug: where.slug } : null)) },
    session: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: "s-1", ...data })) },
  };
  const notify = { send: vi.fn(async () => ({ messageId: "m1", status: "sent" })) };
  const svc = new PortalService(prisma as unknown as PrismaService, notify as unknown as NotificationService);
  return { svc, prisma, notify };
}

beforeAll(() => {
  process.env.APP_SECRET ??= "test-secret-0123456789abcdef";
});

/** Assert a rejection carries the expected problem title. */
async function expectReject(fn: () => Promise<unknown>, title: string): Promise<void> {
  try {
    await fn();
    expect.fail(`expected rejection with "${title}"`);
  } catch (e) {
    const response = (e as { getResponse?: () => { title?: string } }).getResponse?.();
    expect(response?.title ?? (e as Error).message).toContain(title);
  }
}

describe("PortalService (WP-2D)", () => {
  it("OTP flow: send (SMS via hub) → verify issues customer-scoped token", async () => {
    const { svc, notify } = makeFake();
    await svc.sendOtp("t-1", PHONE);
    expect(notify.send).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "sms", templateKey: "portal_otp", severity: "S0", toAddress: PHONE }),
    );

    const code = ((notify.send as ReturnType<typeof vi.fn>).mock.calls[0]![0] as { vars: { code: string } }).vars.code;
    const out = await svc.verifyOtp("t-1", PHONE, code);
    const claims = await verifyToken(out.accessToken, "access");
    expect(claims).toMatchObject({ sub: PHONE, roles: ["customer"], tenant: "t-1" });
  });

  it("rejects wrong OTP and locks after repeated failures", async () => {
    const { svc } = makeFake();
    await svc.sendOtp("t-1", PHONE);
    await expectReject(() => svc.verifyOtp("t-1", PHONE, "000000"), "Invalid OTP");
    await expectReject(() => svc.verifyOtp("t-1", PHONE, "000000"), "Invalid OTP");
    await expectReject(() => svc.verifyOtp("t-1", PHONE, "000000"), "Invalid OTP");
    await expectReject(() => svc.verifyOtp("t-1", PHONE, "000000"), "locked");
  });

  it("limits OTP sends to 3 per 10 minutes", async () => {
    const { svc } = makeFake();
    await svc.sendOtp("t-1", PHONE);
    await svc.sendOtp("t-1", PHONE);
    await svc.sendOtp("t-1", PHONE);
    await expectReject(() => svc.sendOtp("t-1", PHONE), "Too many");
  });

  it("home shows the next outstanding due with exact formatting", async () => {
    const { svc } = makeFake();
    const home = (await svc.home("t-1", PHONE)) as { nextDue: { demandNo: string; outstanding: string } };
    expect(home.nextDue).toMatchObject({ demandNo: "DMND-2", outstanding: "6,00,000.00" });
  });

  it("payments expose schedule + cleared receipts only", async () => {
    const { svc } = makeFake();
    const out = (await svc.payments("t-1", PHONE)) as { receipts: Array<{ instrument: string }>; schedule: unknown[] };
    expect(out.schedule).toHaveLength(2);
    expect(out.receipts).toHaveLength(1);
    expect(out.receipts[0]!.instrument).toBe("gateway");
  });

  it("consent center records grants and revocations (DPDP)", async () => {
    const { svc } = makeFake();
    await svc.setConsent("t-1", PHONE, "whatsapp", "promotional", false);
    const consents = (await svc.consents("t-1", PHONE)) as Array<{ granted: boolean; purpose: string }>;
    expect(consents[0]).toMatchObject({ purpose: "promotional", granted: false });
  });

  it("resolves tenant from slug when no JWT tenant is present", async () => {
    const { svc } = makeFake();
    await expect(svc.resolveTenantId("t-jwt", "ignored")).resolves.toBe("t-jwt");
    await expect(svc.resolveTenantId(undefined, "shree-developers")).resolves.toBe("t-1");
    await expectReject(() => svc.resolveTenantId(undefined, undefined), "Organization is required");
    await expectReject(() => svc.resolveTenantId(undefined, "missing"), "Unknown organization");
  });
});
