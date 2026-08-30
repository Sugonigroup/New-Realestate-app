/**
 * Outbox relay (03 §4): the bridge between the transactional outbox and every
 * consumer — the AI event dispatcher, commission accrual, escrow classification.
 * Poll-based, batched, idempotent (publishedAt marker), failure-safe (a failing
 * handler leaves the event unpublished for retry — at-least-once delivery).
 */

export interface OutboxRow {
  id: string;
  tenantId: string;
  aggregate: string;
  type: string;
  payload: Record<string, unknown>;
  publishedAt?: Date | null;
}

export interface OutboxStore {
  fetchUnpublished(limit: number): Promise<OutboxRow[]>;
  markPublished(id: string): Promise<void>;
}

export type EventHandler = (event: OutboxRow) => Promise<void>;

export interface RelayStats {
  processed: number;
  failed: number;
  failures: Array<{ id: string; type: string; error: string }>;
}

export class OutboxRelay {
  private readonly handlers = new Map<string, EventHandler[]>();

  constructor(
    private readonly store: OutboxStore,
    private readonly batchSize = 50,
  ) {}

  /** Register a consumer; "*" receives every event type. */
  on(eventType: string, handler: EventHandler): this {
    const list = this.handlers.get(eventType) ?? [];
    list.push(handler);
    this.handlers.set(eventType, list);
    return this;
  }

  private handlersFor(eventType: string): EventHandler[] {
    const specific = this.handlers.get(eventType) ?? [];
    const wildcard = this.handlers.get("*") ?? [];
    return [...wildcard, ...specific];
  }

  /** One relay pass. Safe to run repeatedly (cron/poll loop owns scheduling). */
  async poll(now: Date = new Date()): Promise<RelayStats> {
    const rows = await this.store.fetchUnpublished(this.batchSize);
    const stats: RelayStats = { processed: 0, failed: 0, failures: [] };

    for (const row of rows) {
      const handlers = this.handlersFor(row.type);
      let failed = false;
      let lastError = "";
      for (const handler of handlers) {
        try {
          await handler(row);
        } catch (e) {
          failed = true;
          lastError = (e as Error).message;
        }
      }
      if (failed) {
        stats.failed += 1;
        stats.failures.push({ id: row.id, type: row.type, error: lastError });
        continue; // leave unpublished → retried next pass
      }
      await this.store.markPublished(row.id);
      stats.processed += 1;
    }
    void now;
    return stats;
  }
}
