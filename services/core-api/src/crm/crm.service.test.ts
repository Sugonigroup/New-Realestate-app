import { describe, expect, it, vi } from "vitest";
import { CrmService, type IngestInput } from "./crm.service.js";
import type { RoutingContext } from "./crm.service.js";

// strong-typed in-memory fake
function makeFake(existing: Array<Record<string, unknown>> = []) {
  let seq = 0;
  const leads = [...existing];
  const outboxRows: Array<Record<string, unknown>> = [];
  const auditRows: Array<Record<string, unknown>> = [];
  const interactionRows: Array<Record<string, unknown>> = [];
  const prisma = {
    lead: {
      findMany: vi.fn(async ({ where }: { where: { phone?: string; tenantId: string } }) =>
        leads.filter((l) => l.tenantId === where.tenantId && (!where.phone || l.phone === where.phone)),
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, id: `lead-${++seq}` };
        leads.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: { where: { id: string; tenantId: string } }) =>
        leads.find((l) => l.id === where.id && l.tenantId === where.tenantId),
      ),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = leads.find((l) => l.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
    },
    outboxEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => void outboxRows.push(data)) },
    auditEvent: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => void auditRows.push(data)) },
    interaction: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `in-${++seq}`, createdAt: new Date(), ...data };
        interactionRows.push(row);
        return row;
      }),
    },
  };
  return { prisma, leads, outboxRows, auditRows, interactionRows };
}

const ROUTING: RoutingContext = {
  rules: [{ assignToUsers: ["exec-1", "exec-2"] }],
  userLoad: new Map([["exec-1", 3], ["exec-2", 1]]),
  lastAssigned: new Map(),
};

const input: IngestInput = {
  tenantId: "t-1",
  source: "website",
  projectId: "proj-a",
  fullName: "ravi kumar",
  phone: "+91 98765 43210",
  email: "Ravi@Example.com",
};

describe("CrmService ingestion pipeline (WP-1A)", () => {
  it("creates a routed lead with normalized fields, SLA clock, outbox event and audit", async () => {
    const { prisma, leads, outboxRows } = makeFake();
    const svc = new CrmService(prisma as never);
    const out = await svc.ingest(input, ROUTING);

    expect(out.status).toBe("created");
    expect(out.assignedUserId).toBe("exec-2"); // least loaded
    const lead = leads[0]!;
    expect(lead).toMatchObject({ fullName: "Ravi Kumar", phone: "+919876543210", email: "ravi@example.com", status: "new" });
    expect(lead.slaRespondBy).toBeDefined();
    expect(outboxRows[0]).toMatchObject({ type: "lead.created.v1", aggregate: "lead" });
  });

  it("same phone + project is a duplicate (no new lead, no event)", async () => {
    const { prisma, leads, outboxRows } = makeFake([
      { id: "l-existing", tenantId: "t-1", phone: "+919876543210", projectId: "proj-a", status: "qualified" },
    ]);
    const svc = new CrmService(prisma as never);
    const out = await svc.ingest(input, ROUTING);
    expect(out.status).toBe("duplicate");
    expect(out.leadId).toBe("l-existing");
    expect(leads).toHaveLength(1);
    expect(outboxRows).toHaveLength(0);
  });

  it("same phone + other project creates a linked opportunity", async () => {
    const { prisma, leads } = makeFake([
      { id: "l-existing", tenantId: "t-1", phone: "+919876543210", projectId: "proj-a", status: "qualified" },
    ]);
    const svc = new CrmService(prisma as never);
    const out = await svc.ingest({ ...input, projectId: "proj-b" }, ROUTING);
    expect(out.status).toBe("created");
    expect(out.dedupFlag).toBe("linked");
    expect(leads).toHaveLength(2);
  });

  it("invalid phone is rejected with a reason", async () => {
    const { prisma } = makeFake();
    const svc = new CrmService(prisma as never);
    const out = await svc.ingest({ ...input, phone: "12345" }, ROUTING);
    expect(out.status).toBe("rejected");
    expect(out.reason).toMatch(/invalid phone/);
  });

  it("first interaction stops the SLA clock and moves new → contacted", async () => {
    const { prisma, leads } = makeFake();
    const svc = new CrmService(prisma as never);
    const started = await svc.ingest(input, ROUTING);
    const out = await svc.addInteraction("t-1", started.leadId!, {
      type: "whatsapp",
      disposition: "introduced",
      byUserId: "exec-2",
    });
    expect(out.leadStatus).toBe("contacted");
    expect(leads[0]!.firstRespondedAt).toBeDefined();
  });

  it("CSV import produces a report: imported, duplicates, rejected rows", async () => {
    const { prisma, leads } = makeFake([
      { id: "l-existing", tenantId: "t-1", phone: "+919876543210", projectId: "proj-a", status: "qualified" },
    ]);
    const svc = new CrmService(prisma as never);
    const csv = [
      "fullName,phone,email",
      "Amit Verma,+91 98111 11111,amit@x.com",
      "Ravi Kumar,+91 98765 43210,ravi@example.com", // duplicate
      "Bad Row,123,bad@x.com", // rejected
      "Priya Singh,98222 22222,priya@x.com",
    ].join("\n");
    const report = await svc.importCsv("t-1", csv, ROUTING, { projectId: "proj-a" });
    expect(report.imported).toBe(2);
    expect(report.duplicates).toBe(1);
    expect(report.rejected).toEqual([{ row: 3, reason: expect.stringMatching(/invalid phone/) }]);
    expect(leads).toHaveLength(3); // 1 existing + 2 imported
  });
});
