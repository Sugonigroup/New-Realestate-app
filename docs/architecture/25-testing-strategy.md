# 25 — Testing Strategy

ERP test gates inherit `../../03 §8` (unit ≥85% domain, contract, integration with Testcontainers, E2E Playwright, money golden-files, load k6, authz fuzz, RLS probes). This file adds the **AI test plane** — the biggest testing risk in the system.

## 1. Test pyramid (extended)

| Level | Scope | Tooling | Gate |
|---|---|---|---|
| Unit | domain math (EVM, schedules, tax, deductions), KPI formulas (14), policy engine, decision routing | Vitest + fast-check property tests | ≥85% domain packages |
| Contract | OpenAPI ↔ handlers; tool schemas ↔ policy engine; event schemas | Zod + oasdiff | no unregistered breaking change |
| Integration | contexts + Postgres/Redis (Testcontainers); agent runtime with **stubbed LLM** (deterministic canned outputs) + real tools/policy/DB | Vitest | all golden flows |
| E2E | journeys incl. AI: DPR→progress→delay→recommendation→approval→execution; bill→anomaly→human approve; ask-AI scoped answer | Playwright | CI nightly + pre-release |
| Money correctness | 20 unit × plan × GST/TDS/forfeiture golden files | snapshots | exact paise |
| Load | 500 rps read burst, booking queue, agent storm (1000 DPR events) | k6 | SLOs (03 §2) |
| Security | authz fuzz incl. **agent identities × tools × scopes**; RLS cross-tenant probes; ZAP baseline; prompt-injection corpus | CI weekly | zero criticals |

## 2. AI evaluation harness (`ai_evals`, `05 §2`)

| Suite | Content | Cadence | Pass bar |
|---|---|---|---|
| Extraction golden set | 50 labeled docs (BOQ/invoice/contract/cert) — field-exact assertions | every parser/prompt change | ≥98% field accuracy (money fields 100%) |
| Classification set | NCR photos, safety observations, doc classes | changes | ≥90% + human-review routing correct |
| Recommendation quality | 40 seeded scenarios → correct risk class + action level (10 §3 routing) | every release | 100% routing correctness (deterministic asserts) |
| Red-team / injection | instruction-embedded documents, hostile DPRs, cross-tenant probes, tool-abuse attempts | weekly + before AI phase exits | 0 successful injections/actions; all logged+denied |
| Regression replay | pinned `agent_runs` replayed on new prompt versions; diff report | prompt promotion | no quality-score drop >10 pts |

## 3. Determinism guarantees (tested, not assumed)

- "LLM never computes money": static-analysis lint forbids LLM output feeding financial fields without deterministic validation; integration tests assert computed vs posted values.
- Autonomy routing is pure-function tested (severity × confidence × policy → verdict) across the full matrix (10 §2).
- Idempotency: double-delivery of every event/journey in CI.

## 4. Shadow mode & progressive rollout

New agent/prompt versions run **read-only shadow** on staging and prod-like data; promote per-tenant via eval gate + kill-switch default-off; rollback = pin previous prompt version (artifact store), no redeploy.
