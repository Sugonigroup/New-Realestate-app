import { PrismaClient } from "@prisma/client";
import type { OutboxRow, OutboxStore } from "./outbox-relay.js";

/** Prisma-backed outbox store — the DB is the queue's source of truth. */
export class PrismaOutboxStore implements OutboxStore {
  constructor(private readonly prisma: PrismaClient) {}

  async fetchUnpublished(limit: number): Promise<OutboxRow[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      aggregate: r.aggregate,
      type: r.type,
      payload: (r.payload ?? {}) as Record<string, unknown>,
      publishedAt: r.publishedAt,
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.outboxEvent.update({ where: { id }, data: { publishedAt: new Date() } });
  }
}
