/**
 * Worker process entry (outbox relay, BullMQ crons, notification dispatch).
 * Phase 0 WP-0B/WP-0H wire the queues; this entry exists so the workspace
 * builds and deploys as one image with a separate worker entrypoint (ADR-AI1).
 */
export const WORKER_ENTRYPOINT = "buildos-workers";
