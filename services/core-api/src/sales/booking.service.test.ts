import { describe, expect, it, vi } from "vitest";
import type { PlanMilestone } from "./schedule.js";
import { BookingService } from "./booking.service.js";
import type { NotificationService } from "../notify/notification.service.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { WorkflowService } from "../workflow/workflow.service.js";

const TENANT = "t-1";
const UNIT = "unit-1";
const MILESTONES: PlanMilestone[] = [
  { key: "booking", label: "On booking", percent: 10, trigger: { kind: "on_booking" } },
  { key: "agreement", label: "On AFT (15d)", percent: 10, trigger: { kind: "days_from_booking", days: 15 } },
  { key: "possession", label: "On possession", percent: 80, trigger: { kind: "construction_milestone", milestoneKey: "possession" } },
];

interface BookingRow {
  id: string;
  tenantId: string;
  unitId: string;
  status: string;
  aftStatus?: string;
  totalPaise: bigint;
  discountPct: number;
  discountPaise: bigint;
  workflowId?: string;
  scheduleSnapshot?: Array<{ amountPaise: string }>;
  cancelledAt?: Date;
  [key: string]: unknown;
}

function makeFake() {
  const db = {
    units: [{ id: UNIT, tenantId: TENANT, state: "available", code: "T1-101" }],
    holds: [] as Array<{ id: string; status: string; expiresAt: Date; [key: string]: unknown }>,
    bookings: [] as BookingRow[],
    workflows: {} as Record<string, string>,
    outbox: [] as Array<Record<string, unknown>>,
    audits: [] as Array<Record<string, unknown>>,
  };
  let seq = 0;
  const prisma = {
    unit: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => db.units.find((u) => u.id === where.id)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const u = db.units.find((x) => x.id === where.id)!;
        Object.assign(u, data);
        return u;
      }),
    },
    hold: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          ...(data as Record<string, unknown>),
          id: `hold-${++seq}`,
          status: (data.status as string) ?? "active",
        };
        db.holds.push(row as { id: string; status: string; expiresAt: Date; [key: string]: unknown });
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => db.holds.find((h) => h.id === where.id)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const h = db.holds.find((x) => x.id === where.id)!;
        Object.assign(h, data);
        return h;
      }),
    },
    booking: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `bk-${++seq}` } as BookingRow;
        db.bookings.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) => db.bookings.find((b) => b.id === where.id)),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const b = db.bookings.find((x) => x.id === where.id)!;
        Object.assign(b, data);
        return b;
      }),
    },
    workflowInstance: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        db.workflows[where.id] ? { id: where.id, state: db.workflows[where.id] } : null,
      ),
    },
    paymentPlanTemplate: {
      findFirst: vi.fn(async () => ({ milestones: MILESTONES })),
    },
    outboxEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => void db.outbox.push(data)) },
    auditEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => void db.audits.push(data)) },
  };
  const workflow = {
    start: vi.fn(async (input: { valuePaise: bigint }) => {
      const id = `wf-${++seq}`;
      db.workflows[id] = "pending";
      void input;
      return { instanceId: id, taskId: "task-1", approverRole: "cfo" };
    }),
  };
  const notify = { triggerJourney: vi.fn(async () => ({ runId: "r", status: "completed", sends: 1 })) };
  const svc = new BookingService(
    prisma as unknown as PrismaService,
    workflow as unknown as WorkflowService,
    notify as unknown as NotificationService,
  );
  return { svc, db, workflow, notify };
}

const TOTAL = 1_000_000_000n; // ₹1,00,00,000
const submit = (svc: BookingService, holdId: string, discountPct = 0) =>
  svc.submitBooking({
    tenantId: TENANT, unitId: UNIT, holdId, leadId: "lead-1",
    customerName: "Ravi Kumar", customerPhone: "+919876543210",
    planCode: "CLP-STD", planType: "CLP", milestones: MILESTONES,
    totalPaise: TOTAL, discountPct, initiatorUserId: "exec-1",
  });

describe("BookingService (WP-1D)", () => {
  it("hold: available → held with expiry recorded", async () => {
    const { svc, db } = makeFake();
    const hold = await svc.holdUnit({ tenantId: TENANT, unitId: UNIT, userId: "exec-1", holdHours: 24 });
    expect(db.units[0]!.state).toBe("held");
    expect(db.holds[0]!.status).toBe("active");
    expect(hold.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("no-discount flow: submit → confirm with exact schedule snapshot and events", async () => {
    const { svc, db, notify } = makeFake();
    const hold = await svc.holdUnit({ tenantId: TENANT, unitId: UNIT, userId: "exec-1" });
    const submitted = await submit(svc, hold.holdId);
    expect(submitted.status).toBe("draft");

    const confirmed = (await svc.confirmBooking(TENANT, submitted.bookingId, "exec-1")) as {
      status: string;
      totalPaise: string;
    };
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.totalPaise).toBe("1000000000");
    expect(db.units[0]!.state).toBe("booked");
    expect(db.holds[0]!.status).toBe("converted");

    const schedule = db.bookings[0]!.scheduleSnapshot!;
    const sum = schedule.reduce((a, s) => a + BigInt(s.amountPaise), 0n);
    expect(sum).toBe(TOTAL);
    expect(db.outbox.map((o) => o.type)).toContain("booking.confirmed.v1");
    expect(notify.triggerJourney).toHaveBeenCalledWith(TENANT, "booking_welcome", "+919876543210", expect.anything());
  });

  it("discount flow: 6% routes to the authority matrix; confirm blocked until approved", async () => {
    const { svc, db, workflow } = makeFake();
    const hold = await svc.holdUnit({ tenantId: TENANT, unitId: UNIT, userId: "exec-1" });
    const submitted = await submit(svc, hold.holdId, 6);
    expect(submitted.status).toBe("pending_approval");
    expect(workflow.start).toHaveBeenCalledWith(
      expect.objectContaining({ action: "sales.discount", valuePaise: 60000000n }),
    );
    expect(db.bookings[0]!.discountPaise).toBe(60000000n);

    await expect(svc.confirmBooking(TENANT, submitted.bookingId, "cfo-1")).rejects.toThrow(/approval pending/);

    db.workflows[submitted.workflowId!] = "approved";
    const confirmed = (await svc.confirmBooking(TENANT, submitted.bookingId, "cfo-1")) as { totalPaise: string };
    expect(confirmed.totalPaise).toBe("940000000"); // ₹94,00,000 net
    const schedule = db.bookings[0]!.scheduleSnapshot!;
    expect(schedule.reduce((a, s) => a + BigInt(s.amountPaise), 0n)).toBe(940000000n);
  });

  it("customer-exit cancellation: 15% post-AFT forfeiture, unit released, clawback event", async () => {
    const { svc, db } = makeFake();
    const hold = await svc.holdUnit({ tenantId: TENANT, unitId: UNIT, userId: "exec-1" });
    const submitted = await submit(svc, hold.holdId);
    await svc.confirmBooking(TENANT, submitted.bookingId, "exec-1");

    const out = (await svc.cancelBooking(TENANT, submitted.bookingId, "crm-1", {
      initiator: "customer", stage: "post_aft", paidPaise: 50_000_000n,
    })) as { forfeitPaise: string; refundPaise: string };
    expect(out.forfeitPaise).toBe("7500000"); // 15% of ₹5,00,000
    expect(out.refundPaise).toBe("42500000");
    expect(db.units[0]!.state).toBe("available");
    expect(db.bookings[0]!.status).toBe("cancelled");
    expect(db.outbox.at(-1)).toMatchObject({ type: "unit.cancelled.v1", payload: { clawback: true } });
  });

  it("builder default: full refund plus RERA interest for the delay days", async () => {
    const { svc } = makeFake();
    const hold = await svc.holdUnit({ tenantId: TENANT, unitId: UNIT, userId: "exec-1" });
    const submitted = await submit(svc, hold.holdId);
    await svc.confirmBooking(TENANT, submitted.bookingId, "exec-1");

    const out = (await svc.cancelBooking(TENANT, submitted.bookingId, "cfo-1", {
      initiator: "builder", stage: "post_aft", paidPaise: 50_000_000n, builderDelayDays: 365,
    })) as { forfeitPaise: string; interestPaise: string; refundPaise: string; notes: string[] };
    expect(out.forfeitPaise).toBe("0");
    expect(out.interestPaise).toBe("5125000"); // ₹5,00,000 × 10.25% × 365/365
    expect(out.refundPaise).toBe("55125000");
    expect(out.notes.some((n: string) => n.includes("Section 18"))).toBe(true);
  });

  it("AFT status advances strictly (draft→sent→signed→registered)", async () => {
    const { svc, db } = makeFake();
    const hold = await svc.holdUnit({ tenantId: TENANT, unitId: UNIT, userId: "exec-1" });
    const submitted = await submit(svc, hold.holdId);
    await svc.confirmBooking(TENANT, submitted.bookingId, "exec-1");

    await expect(svc.advanceAft(TENANT, submitted.bookingId, "sent")).rejects.toThrow(/illegal/);
    await svc.advanceAft(TENANT, submitted.bookingId, "draft");
    await svc.advanceAft(TENANT, submitted.bookingId, "sent");
    await svc.advanceAft(TENANT, submitted.bookingId, "signed");
    await svc.advanceAft(TENANT, submitted.bookingId, "registered");
    expect(db.bookings[0]!.aftStatus).toBe("registered");
  });
});
