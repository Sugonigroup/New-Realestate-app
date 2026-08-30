import { describe, expect, it, vi } from "vitest";
import { OutboxRelay, type OutboxRow, type OutboxStore } from "./outbox-relay.js";
import { wireProductionHandlers, type RelayDeps } from "./handlers.js";

function makeStore(rows: OutboxRow[]) {
  const published: string[] = [];
  const store: OutboxStore = {
    fetchUnpublished: vi.fn(async (limit: number) => rows.filter((r) => !r.publishedAt).slice(0, limit)),
    markPublished: vi.fn(async (id: string) => void published.push(id)),
  };
  return { store, published };
}

const event = (id: string, type: string): OutboxRow => ({
  id, tenantId: "t-1", aggregate: "test", type, payload: {}, publishedAt: null,
});

describe("outbox relay (Phase 7 wiring)", () => {
  it("processes events through wildcard + specific handlers and marks published", async () => {
    const relay = new OutboxRelay({ fetchUnpublished: async () => [event("e1", "receipt.cleared.v1")], markPublished: vi.fn() });
    const seen: string[] = [];
    relay.on("*", async () => void seen.push("wildcard"));
    relay.on("receipt.cleared.v1", async () => void seen.push("receipt"));
    const stats = await relay.poll();
    expect(stats.processed).toBe(1);
    expect(stats.failed).toBe(0);
    expect(seen).toEqual(["wildcard", "receipt"]);
  });

  it("failure-safe: a failing handler leaves the event unpublished for retry", async () => {
    const { store, published } = makeStore([event("e1", "receipt.cleared.v1")]);
    const relay = new OutboxRelay(store);
    relay.on("receipt.cleared.v1", async () => { throw new Error("escrow down"); });
    const stats = await relay.poll();
    expect(stats.failed).toBe(1);
    expect(stats.failures[0]).toMatchObject({ id: "e1", error: "escrow down" });
    expect(published).toHaveLength(0);
  });

  it("already-published events are never reprocessed", async () => {
    const rows = [event("e1", "receipt.cleared.v1"), event("e2", "receipt.cleared.v1")];
    rows[0]!.publishedAt = new Date();
    const { store, published } = makeStore(rows);
    const relay = new OutboxRelay(store);
    relay.on("receipt.cleared.v1", async () => {});
    const stats = await relay.poll();
    expect(stats.processed).toBe(1);
    expect(published).toEqual(["e2"]);
  });

  it("unhandled event types pass through as processed (no subscribers ≠ failure)", async () => {
    const { store, published } = makeStore([event("e1", "something.else")]);
    const relay = new OutboxRelay(store);
    const stats = await relay.poll();
    expect(stats.processed).toBe(1);
    expect(published).toEqual(["e1"]);
  });

  it("production wiring: booking lifecycle reaches dispatcher + finance consumers", async () => {
    const relay = new OutboxRelay({ fetchUnpublished: async () => [
      event("e1", "receipt.cleared.v1"),
      event("e2", "unit.cancelled.v1"),
      event("e3", "milestone.certified.v1"),
    ], markPublished: vi.fn() });
    const calls: string[] = [];
    const deps: RelayDeps = {
      dispatchToAgents: vi.fn(async () => void calls.push("ai")),
      onReceiptCleared: vi.fn(async () => void calls.push("commission+escrow")),
      onUnitCancelled: vi.fn(async () => void calls.push("clawback")),
      onMilestoneCertified: vi.fn(async () => void calls.push("demands")),
      onDemandDue: vi.fn(async () => void calls.push("dunning")),
    };
    wireProductionHandlers(relay, deps);
    const stats = await relay.poll();
    expect(stats.processed).toBe(3);
    expect(calls).toEqual(["ai", "commission+escrow", "ai", "clawback", "ai", "demands"]);
  });
});
