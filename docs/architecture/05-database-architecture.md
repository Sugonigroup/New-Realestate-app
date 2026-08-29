# 05 — Database Architecture

Engine: **PostgreSQL 16** (RDS Multi-AZ), schema-per-bounded-context, Prisma migrations, RLS tenancy — all per `../../02 §4/§5` and `../../03 §1` (existing decisions, unchanged).

## 1. Schema layout

| Schema | Contents |
|---|---|
| `tenancy, identity` | tenants, org tree, users, roles, permissions, sessions |
| `workflow` | workflow_defs/instances/tasks, delegations, **approval_requests (unified human+AI)** |
| `crm, sales, marketing` | leads→bookings, units, pricing, commissions |
| `projects, siteops, procurement, inventory, contractors, quality, safety` | construction domains (04 §2) |
| `finance` | demands, receipts, escrow, budgets, cost, AP, tax |
| `compliance, hr` | RERA/QPR, statutory calendar, employees, payroll |
| `docs` | documents, versions, esign |
| `notify` | templates, journeys, consent, message_log |
| `audit` | append-only `audit_event` |
| `ai_orchestration` | agents, agent_runs, schedules |
| `ai_decisions` | ai_observation→decision records + evidence |
| `ai_actions` | tool calls, policy verdicts, approvals, execution results |
| `ai_memory` | project/operational/user/agent memory |
| `knowledge` | rag_documents, chunks, embeddings (pgvector), retrieval_log |
| `reporting` | report_defs, report_runs, kpi_snapshots |

## 2. AI execution & decision tables (new — the auditability core)

```sql
-- one row per agent invocation (scheduled or event-triggered)
agent_runs(id, tenant_id, agent_code, trigger_type[event|cron|manual], trigger_event_id,
           input_ref jsonb, user_context jsonb, model, prompt_version, started_at, finished_at,
           status, tokens_in, tokens_out, cost_paise, trace_id)

-- the traceable decision chain (10-ai-autonomy-policy.md §6)
ai_decisions(id, tenant_id, run_id, observation jsonb, analysis jsonb,
             risk jsonb,            -- severity, financial/schedule/operational impact
             recommendation jsonb, action_type, action_payload jsonb,
             confidence numeric, evidence jsonb,     -- [{type:record|doc|computation, id, digest}]
             created_at)

ai_actions(id, tenant_id, decision_id, tool_name, tool_args jsonb,
           autonomy_level int, policy_verdict jsonb,   -- allow/deny/approval_required + reason
           approval_id uuid NULL,                      -- FK workflow.approval_requests (human)
           execution_status, execution_result jsonb, error jsonb, executed_at)

ai_evals(id, tenant_id, run_id, eval_suite, passed bool, scores jsonb, notes)  -- quality signals
```
Rules: append-only (no UPDATE grants); `evidence` is mandatory for confidence ≥ any autonomous level; every row carries `tenant_id` + RLS policy like all tables (`../../03 §1`).

## 3. Event & outbox tables (existing design, unchanged)

`outbox(id, tenant_id, aggregate, type, payload, created_at, published_at)` → Redis Streams; consumers idempotent via `processed_events`. AI consumers register like any consumer (`11-event-architecture.md`).

## 4. Conventions (all tables)

| Rule | Mechanism |
|---|---|
| Tenant isolation | `tenant_id NOT NULL` + Postgres RLS `tenant_id = current_setting('app.tenant_id')` |
| Project isolation | `project_id` where applicable + RBAC data-scope filters (app layer) |
| Soft deletion | `deleted_at` (never for financial/statutory records — void+reversal per `../../01 BR-L`) |
| Versioning | effective-dated masters (price lists, tax rates, authority matrices); document versions in `docs` |
| Timestamps | `created_at/updated_at` timestamptz, IST business layer |
| Audit | every mutation → `audit.audit_event` (append-only, 7-year retention) |
| Money/qty | `bigint` paise; quantities `numeric(18,4)` with unit |
| IDs | UUIDv7 primary keys (time-ordered) |

## 5. Indexing & constraints (key ones)

- FKs with `ON DELETE RESTRICT` for financial/statutory; `SET NULL` for soft refs.
- Partial indexes for hot queries: `demands(status='due')`, `units(state)`, `purchase_orders(status='open')`, `approval_tasks(state='pending', sla_due)`.
- Event fan-out: index `outbox(published_at)`; agent polling uses `agent_runs(status, next_run_at)`.
- Exclusion constraint: no overlapping `effective_from..effective_to` on price lists/tax rates.
- Check constraints: `receipts.amount > 0`, `ai_actions.autonomy_level BETWEEN 0 AND 5`.
- pgvector: `chunks.embedding vector(1536)` + HNSW index; retrieval always joined to permission filter (15 §4).

## 6. Analytics layer

Nightly marts into `reporting.kpi_snapshots` (per `14-kpi-framework.md` definitions) from read replica; ClickHouse deferred behind same interface (ADR in `../../02 ADR-07` unchanged). AI agents read snapshots — they do **not** run analytical SQL against OLTP during business hours.

## 7. ERD

See `06-erd.md` (Mermaid erDiagram, core entities + AI tables).
