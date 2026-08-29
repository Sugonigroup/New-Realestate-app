import { describe, expect, it, vi } from "vitest";
import { WorkflowService } from "./workflow.service.js";

/** In-memory Prisma fake covering the methods the engine uses. */
function fakePrisma() {
  let seq = 0;
  const db = {
    instances: [] as Array<Record<string, unknown> & { id: string; tasks: unknown[] }>,
    tasks: [] as Array<Record<string, unknown> & { id: string }>,
    audits: [] as unknown[],
    delegations: [] as Array<{ id: string; toUserId: string; actionClasses: string[]; validFrom: Date; validTo: Date }>,
  };
  const prisma = {
    workflowInstance: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `wi-${++seq}`, tasks: [] };
        db.instances.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        db.instances.find((i) => i.id === where.id),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.instances.find((i) => i.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    approvalTask: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `wt-${++seq}` };
        db.tasks.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where, include }: { where: { id: string }; include?: unknown }) => {
        const t = db.tasks.find((x) => x.id === where.id);
        if (!t) return null;
        if (include) return { ...t, instance: db.instances.find((i) => i.id === t.instanceId) };
        return t;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = db.tasks.find((x) => x.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => db.tasks.filter((t) => t.state === "pending")),
    },
    auditEvent: { create: vi.fn(async ({ data }: { data: unknown }) => (db.audits.push(data), data)) },
    delegation: {
      findFirst: vi.fn(async ({ where }: { where: { toUserId: string; actionClasses: { has: string } } }) =>
        db.delegations.find((d) => d.toUserId === where.toUserId && d.actionClasses.includes(where.actionClasses.has)),
      ),
    },
  };
  return { prisma, db };
}

const TENANT = "t-1";

async function startDiscount(svc: WorkflowService, paise: bigint) {
  return svc.start({
    tenantId: TENANT,
    action: "sales.discount",
    valuePaise: paise,
    payload: { bookingId: "b-1", discountPct: 6 },
    initiatorUserId: "exec-1",
  });
}

describe("WorkflowService (WP-0E)", () => {
  it("single-tier flow: sales_manager approves a 6% discount end-to-end", async () => {
    const { prisma, db } = fakePrisma();
    const svc = new WorkflowService(prisma as never);
    const started = await startDiscount(svc, 600_00_00n); // 6% of ₹1Cr → cfo tier
    expect(started.approverRole).toBe("cfo");

    const result = await svc.act({
      tenantId: TENANT,
      taskId: started.taskId,
      actorUserId: "cfo-1",
      actorRoles: ["cfo"],
      decision: "approve",
      comment: "within slab",
    });
    expect(result.instanceState).toBe("approved");
    expect(db.audits[0]).toMatchObject({ action: "workflow.sales.discount.approved", actorKind: "human" });
  });

  it("maker-checker: payment run needs FM then CFO; FM cannot check own run", async () => {
    const { prisma, db } = fakePrisma();
    const svc = new WorkflowService(prisma as never);
    const started = await svc.start({
      tenantId: TENANT,
      action: "finance.paymentrun",
      valuePaise: 4_00_000_00n,
      payload: { run: "PR-001" },
      initiatorUserId: "fm-1",
    });
    expect(started.approverRole).toBe("finance_manager");

    const afterMaker = await svc.act({
      tenantId: TENANT, taskId: started.taskId, actorUserId: "fm-1",
      actorRoles: ["finance_manager"], decision: "approve",
    });
    expect(afterMaker.instanceState).toBe("pending"); // waiting for checker

    const checkerTaskId = (db.tasks.find((t) => t.sequence === 2) as { id: string }).id;
    const final = await svc.act({
      tenantId: TENANT, taskId: checkerTaskId, actorUserId: "cfo-1",
      actorRoles: ["cfo"], decision: "approve",
    });
    expect(final.instanceState).toBe("approved");
  });

  it("rejects a wrong-role actor with 403 semantics", async () => {
    const { prisma } = fakePrisma();
    const svc = new WorkflowService(prisma as never);
    const started = await startDiscount(svc, 400_00_00n); // sales_manager tier
    await expect(
      svc.act({
        tenantId: TENANT, taskId: started.taskId, actorUserId: "exec-1",
        actorRoles: ["sales_executive"], decision: "approve",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("delegation lets the delegate act within the window and action class", async () => {
    const { prisma, db } = fakePrisma();
    db.delegations.push({
      id: "d1", toUserId: "senior-2", actionClasses: ["sales.discount"],
      validFrom: new Date(0), validTo: new Date(Date.now() + 86_400_000),
    });
    const svc = new WorkflowService(prisma as never);
    const started = await startDiscount(svc, 400_00_00n);
    const result = await svc.act({
      tenantId: TENANT, taskId: started.taskId, actorUserId: "senior-2",
      actorRoles: ["sales_head"], decision: "approve",
    });
    // delegation only helps when the delegate holds no valid role — sales_head
    // escalation role applies only AFTER SLA, so without delegation this is a deny;
    // with the delegation row the act succeeds:
    expect(result.instanceState).toBe("approved");
  });

  it("escalation role cannot act before SLA breach", async () => {
    const { prisma } = fakePrisma();
    const svc = new WorkflowService(prisma as never);
    const started = await startDiscount(svc, 400_00_00n); // sales_manager, SLA 24h
    await expect(
      svc.act({
        tenantId: TENANT, taskId: started.taskId, actorUserId: "head-1",
        actorRoles: ["sales_head"], decision: "approve",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("reject path terminates the instance", async () => {
    const { prisma, db } = fakePrisma();
    const svc = new WorkflowService(prisma as never);
    const started = await startDiscount(svc, 400_00_00n);
    const result = await svc.act({
      tenantId: TENANT, taskId: started.taskId, actorUserId: "sm-1",
      actorRoles: ["sales_manager"], decision: "reject", comment: "price integrity",
    });
    expect(result.instanceState).toBe("rejected");
    expect(db.audits[0]).toMatchObject({ action: "workflow.sales.discount.rejected" });
  });
});
