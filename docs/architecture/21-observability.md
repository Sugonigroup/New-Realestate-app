# 21 — Observability

App observability inherits `../../03 §7` (OpenTelemetry everywhere, RED metrics, structured logs with PII redaction, SLO alerts, runbooks). This file extends to the AI plane.

## 1. What is monitored

| Plane | Signals |
|---|---|
| Application/API | RED per endpoint, latency histograms, error budgets |
| Database | slow queries, replication lag, connection saturation, RLS denials (spike = probe attempt) |
| Jobs/queues | depth, oldest-age, failure rate per queue (19) |
| AI agents | runs by status, duration, retries, per-agent success % |
| Models | latency p50/p95 per provider/model, tokens in/out, cost per run/agent/tenant, provider error rate, failover events |
| Tool layer | call volume per tool, policy denials, L4 approval rate, execution failures |
| Workflows | SLA breaches, DLQ depth, compensation executions |
| Quality | eval suite scores, thumbs-down rate, citation-coverage %, schema-repair rate, denial-burst detector |
| Approval latency | human vs AI-sourced requests, per approver/tier (09 §7) |

## 2. Tracing

One trace per business transaction and per agent run: `event → agent_run → llm_call → tool_call → approval → erp_write`, with `correlation_id`/`causation_id` continuity (11 §5). LLM spans record model, prompt_version, token counts, cost — no prompt payloads in traces (redacted digests only; full payloads in `ai_decisions` for replay).

## 3. Alerts (SLO-based)

| Alert | Condition | Severity |
|---|---|---|
| Money queue stalled | oldest job age > 15 min | page |
| AI run failure spike | >20% failures / 15 min | page |
| Provider outage | 2 consecutive failovers | page |
| Policy denial burst | ≥10/24 h same agent+tool | page + auto-suspend (10 §4) |
| Cost burn | agent at 80% daily budget | ticket; 100% → pause |
| Quality regression | eval score drop >10 pts vs baseline | ticket + rollback prompt version |
| Approval latency breach | AI-sourced L4 median > SLA | digest to MD |

## 4. Dashboards & AI ops console

- Grafana: infra + API (existing plan).
- **AI Operations dashboard** (admin, Super Admin + AI ops role): agent health grid (status, last run, success %, cost today), model spend by agent/tenant vs budget, queue depths, approval funnel (requested→approved→executed), quality-trend chart, denial/injection attempts, kill-switches per agent + global AI pause. Reference wireframe added as D14 in `22 §5`.

## 5. Retention & audit

Metrics 13 months; traces 30 days; logs 90 days hot / 1 year cold; AI decision/action tables = full retention (audit, 7 years) with export; eval results retained with prompt versions for regression comparison.
