import { OutboxRelay, type OutboxRow } from "./outbox-relay.js";

/**
 * Production handler wiring (Phase 7): which consumers run per event type.
 * Each consumer is an injected service method — the relay never imports
 * contexts directly, keeping the worker decoupled and testable.
 */

export interface RelayDeps {
  dispatchToAgents: (event: OutboxRow) => Promise<void>; // AI dispatcher (policy-gated)
  onReceiptCleared: (event: OutboxRow) => Promise<void>; // commission accrual + escrow classification
  onUnitCancelled: (event: OutboxRow) => Promise<void>; // commission clawback
  onMilestoneCertified: (event: OutboxRow) => Promise<void>; // demand generation (FinanceService)
  onDemandDue: (event: OutboxRow) => Promise<void>; // dunning reminders
}

/** Every event reaches the AI dispatcher (its policy gate decides what acts). */
export function wireProductionHandlers(relay: OutboxRelay, deps: RelayDeps): void {
  relay.on("*", (e) => deps.dispatchToAgents(e));
  relay.on("receipt.cleared.v1", (e) => deps.onReceiptCleared(e));
  relay.on("unit.cancelled.v1", (e) => deps.onUnitCancelled(e));
  relay.on("milestone.certified.v1", (e) => deps.onMilestoneCertified(e));
  relay.on("demand.due.v1", (e) => deps.onDemandDue(e));
}
