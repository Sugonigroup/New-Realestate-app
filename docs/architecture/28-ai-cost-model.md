# 28 — AI Usage & Cost-Control Model

AI must be operationally affordable at tenant scale. Costs are governed at the LLM Gateway (routing, caching, budgets) and enforced by the scheduler (`19 §3`).

## 1. Workload classes (drive model routing)

| Class | Workloads | Latency need | Quality need |
|---|---|---|---|
| Extract | OCR follow-on parsing, field extraction, classification | batch | high accuracy, cheap |
| Reason | risk analysis, recommendations, recovery plans, agent loops | minutes | highest |
| Narrate | report narratives, briefs, summaries | minutes | good |
| Chat | ask-AI, copilot | seconds | good + citations |
| Embed | RAG chunk embeddings | batch | stable |

## 2. Routing & cost controls (LLM Gateway)

- **Model routing per class** (e.g., premium frontier for Reason/Chat; small fast models for Extract/Embed; configurable — providers are policy, not architecture): deterministic pre/post code does all math so cheaper models suffice for most classes.
- **Prompt/prefix caching** for system prompts + memory context; **response caching** for identical deterministic-context queries (short TTL).
- **Token budgets:** per agent per day (registry), per tenant per month (policy), global alert at 80%/100%. Scheduler refuses enqueue at budget (degrades to deterministic insights, never blocks ERP).
- **Batching & scheduling:** Extract/Embed off-peak; Reason jobs coalesced per project; quiet-hours narrative generation.
- **Output discipline:** structured JSON (Zod) with max_tokens caps; no free-form long generations.
- **Circuit breakers:** provider failover only within same class/quality bar; sustained outage → suspend (already covered).

## 3. Version & eval economics

Prompt versions are artifacts: a regression found in evals costs one re-run of the suite, not a hotfix cycle; shadow evaluation prevents production waste.

## 4. Cost observability & chargeback

`agent_runs.cost_paise` per run (tokens × tariff); rollups: per agent, per project, per tenant, per day — surfaced on D14 (`21 §4`) and tenant invoice lines (SaaS chargeback line "AI operations", optional per-tenant toggle to disable premium models).

## 5. Planning envelope (order-of-magnitude, to be baselined in Phase 6 shadow)

| Workload | Frequency (₹500Cr tenant) | Relative share |
|---|---|---|
| Daily briefs + weekly/monthly packs | 1+1+14+1 /mo | ~20% |
| Scheduled analysis (agents crons) | ~300 runs/day | ~35% |
| Event-driven runs (DPRs, bills, movements) | ~1500/day | ~25% |
| Extraction/embeddings (documents) | ~500 docs/mo | ~15% |
| Ask-AI | ~200 queries/day | ~5% |

Baseline measured in Phase 6 shadow before enabling paid tiers; budget cap default ₹/tenant/month set at onboarding (`UNKNOWN — REQUIRES CONFIRMATION` until measured: absolute ₹ figures depend on provider tariffs at execution time — do not fix them in code).
