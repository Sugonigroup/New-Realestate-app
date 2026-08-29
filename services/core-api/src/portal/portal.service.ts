import { createHmac, randomInt } from "node:crypto";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Money } from "@buildos/money-utils";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationService } from "../notify/notification.service.js";
import { signToken, ACCESS_TTL_SEC } from "../common/jwt.js";

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 3;

interface OtpRecord {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  tenantId: string;
}

function hashOtp(tenantId: string, phone: string, code: string): string {
  return createHmac("sha256", `${tenantId}:${phone}`).update(code).digest("hex");
}

/**
 * Customer portal BFF (WP-2D): WhatsApp/SMS OTP login, booking summary with the
 * next due demand, payment schedule, receipts, and the DPDP consent center.
 * Customers are scoped by their verified phone — nothing else is addressable.
 */
@Injectable()
export class PortalService {
  private readonly otps = new Map<string, OtpRecord>();
  private readonly attemptsByPhone = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotificationService,
  ) {}

  async sendOtp(tenantId: string, phone: string): Promise<{ sent: boolean }> {
    // rate limit: 3 sends / 10 min per phone
    const now = Date.now();
    const attempts = (this.attemptsByPhone.get(phone) ?? []).filter((t) => now - t < 10 * 60_000);
    if (attempts.length >= 3) throw new UnauthorizedException({ title: "Too many OTP requests" });
    attempts.push(now);
    this.attemptsByPhone.set(phone, attempts);

    const code = String(randomInt(100000, 999999));
    this.otps.set(`${tenantId}:${phone}`, {
      codeHash: hashOtp(tenantId, phone, code),
      expiresAt: now + OTP_TTL_MS,
      attempts: 0,
      tenantId,
    });
    await this.notify.send({
      tenantId,
      channel: "sms",
      templateKey: "portal_otp",
      toRef: phone,
      toAddress: phone,
      purpose: "transactional",
      severity: "S0", // OTP bypasses quiet hours
      vars: { code },
    });
    return { sent: true };
  }

  async verifyOtp(tenantId: string, phone: string, code: string): Promise<{ accessToken: string }> {
    const record = this.otps.get(`${tenantId}:${phone}`);
    if (!record || record.expiresAt < Date.now()) {
      this.otps.delete(`${tenantId}:${phone}`);
      throw new UnauthorizedException({ title: "OTP expired — request a new one" });
    }
    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      this.otps.delete(`${tenantId}:${phone}`);
      throw new UnauthorizedException({ title: "OTP locked — request a new one" });
    }
    if (hashOtp(tenantId, phone, code) !== record.codeHash) {
      record.attempts += 1;
      throw new UnauthorizedException({ title: "Invalid OTP" });
    }
    this.otps.delete(`${tenantId}:${phone}`);

    const bookings = await this.prisma.booking.findMany({
      where: { tenantId, customerPhone: phone, status: "confirmed" },
      take: 1,
    });
    if (bookings.length === 0) throw new UnauthorizedException({ title: "No active booking for this number" });

    const session = await this.prisma.session.create({
      data: { tenantId, userId: phone, deviceId: "portal", expiresAt: new Date(Date.now() + 30 * 86_400_000) },
    });
    const accessToken = await signToken(
      { sub: phone, tenant: tenantId, roles: ["customer"], sid: session.id },
      { type: "access", ttlSec: ACCESS_TTL_SEC },
    );
    return { accessToken };
  }

  /** Home payload (D11): booking summary + next due demand. */
  async home(tenantId: string, phone: string): Promise<unknown> {
    const booking = await this.prisma.booking.findFirst({
      where: { tenantId, customerPhone: phone, status: "confirmed" },
    });
    if (!booking) throw new UnauthorizedException({ title: "No active booking" });
    const demands = (await this.prisma.demand.findMany({
      where: { tenantId, bookingId: booking.id },
    })) as unknown as Array<{ id: string; label: string; amountPaise: bigint; paidPaise: bigint; dueDate: Date | null; demandNo: string }>;
    const nextDue = demands
      .filter((d) => d.amountPaise - d.paidPaise > 0n)
      .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0];
    return {
      booking: {
        id: booking.id,
        customerName: booking.customerName,
        totalPaise: booking.totalPaise.toString(),
        aftStatus: booking.aftStatus,
      },
      nextDue: nextDue
        ? {
            demandNo: nextDue.demandNo,
            label: nextDue.label,
            outstanding: Money.fromPaise(nextDue.amountPaise - nextDue.paidPaise).formatIndian(),
            dueDate: nextDue.dueDate,
          }
        : null,
    };
  }

  /** Payment schedule + receipts for the buyer's unit. */
  async payments(tenantId: string, phone: string): Promise<unknown> {
    const booking = await this.prisma.booking.findFirst({
      where: { tenantId, customerPhone: phone, status: "confirmed" },
    });
    if (!booking) throw new UnauthorizedException({ title: "No active booking" });
    const schedule = (booking.scheduleSnapshot ?? []) as Array<{ seq: number; label: string; amountPaise: string; dueDate: Date | null }>;
    const receipts = await this.prisma.receipt.findMany({
      where: { tenantId, bookingId: booking.id, status: "cleared" },
      orderBy: { clearedAt: "desc" },
    });
    return {
      schedule: schedule.map((s) => ({ ...s, amountFormatted: Money.fromPaise(BigInt(s.amountPaise)).formatIndian() })),
      receipts: receipts.map((r) => ({
        id: r.id,
        amountPaise: r.amountPaise.toString(),
        amountFormatted: Money.fromPaise(r.amountPaise).formatIndian(),
        instrument: r.instrument,
        clearedAt: r.clearedAt,
      })),
    };
  }

  /** DPDP consent center (grant/revoke per channel; STOP semantics honored by hub). */
  async setConsent(tenantId: string, phone: string, channel: string, purpose: string, granted: boolean): Promise<unknown> {
    const row = await this.prisma.consentLedger.create({
      data: {
        tenantId,
        personRef: phone,
        channel,
        purpose,
        grantedAt: granted ? new Date() : null,
        revokedAt: granted ? null : new Date(),
        source: "portal_consent_center",
      },
    });
    return { consentId: row.id, channel, purpose, granted };
  }

  async consents(tenantId: string, phone: string): Promise<unknown> {
    const rows = await this.prisma.consentLedger.findMany({
      where: { tenantId, personRef: phone },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map((r) => ({ channel: r.channel, purpose: r.purpose, granted: !!r.grantedAt && !r.revokedAt, at: r.revokedAt ?? r.grantedAt }));
  }
}
