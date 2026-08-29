# 19 — Background Jobs & Queue Architecture

BullMQ on Redis 7 (existing decision), IST-aware crons, priority classes, DLQ + replay. Worker processes: `erp-workers` and `ai-workers` (same image, separate scaling).

## 1. Queue catalogue

| Queue | Jobs | Class | Schedule / trigger |
|---|---|---|---|
| `q-money` | demand generation, dunning, eNACH debits, interest posting, bank recon, payment-run files | **P0** (never starved) | cron daily + events |
| `q-compliance` | QPR drafts, statutory scans, expiry alerts, escrow breach checks | P0 | daily/quarterly |
| `q-notify` | WhatsApp/email/SMS dispatch, journey steps | P1 | event-driven |
| `q-ai-analysis` | agent runs (all 12), forecast jobs, KPI rollups | P1 | events + crons (11 §4) |
| `q-ai-docs` | OCR, parsing, embeddings, comparisons | P2 | `document.uploaded` |
| `q-reports` | PDF/XLSX rendering, distribution | P2 | schedules |
| `q-analytics` | mart rebuilds, aggregate rollups | P3 | nightly |

## 2. Full async workload list (prompt requirement)

report generation · AI analysis (agent runs) · document processing · OCR · embeddings · notifications · scheduled risk analysis (daily agent sweeps) · data aggregation (KPI snapshots, marts) · forecasting (shortage, completion, EAC) · bank reconciliation · eNACH scheduling · commission accruals · scoring refreshes · cleanup/archival (soft-deletes, memory TTLs).

## 3. Engineering rules

- Idempotent jobs (idempotency keys); at-least-once + dedupe.
- Priority classes strictly separated by consumer groups — a P3 analytics backlog can never delay P0 money jobs (bulkhead, `../../03 §6`).
- AI jobs: per-agent concurrency caps; cost-aware scheduler (28 §2 budgets checked before enqueue); degraded-mode: AI queues pause, deterministic alerts continue.
- Retry: exponential backoff ×3 → DLQ; DLQ replay console; failure > threshold → incident task (07 §5 legacy).
- Observability: queue depth, age, failure-rate dashboards + SLO alerts (21 §3).
- Long jobs (monthly reports, bulk OCR): progress SSE + completion notification; 30-min hard timeout with resumable checkpoints.
