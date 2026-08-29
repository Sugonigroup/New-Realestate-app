# ARCHITECTURE REVIEW — BuildOS AI-Operated Construction ERP

Final review per the review mandate. Written by the combined architect roles. Evidence-based; the current repository is **documentation-only** (`02 §3`) — scores reflect verified reality, not ambition.

## 1. Executive Summary

BuildOS is architected as a two-plane system: a **deterministic ERP (system of record)** covering the full construction + commercial lifecycle, and an **AI operating layer (system of intelligence + action)** of 12 narrowly-scoped agents that observe events, compute risks with deterministic math, prepare decisions with evidence, automate routine work at L3, and execute consequential actions **only through human approval (L4)** — with an explicit prohibited list (L5). The architecture is implementable by a senior team without rediscovery: every module has specifications, contracts, matrices, schemas, and phase-gated acceptance criteria. The single largest execution risk is not AI capability but **delivery discipline** — the ERP must exist and be trustworthy before autonomy is enabled.

## 2. Current Architecture

Documentation-only repository: 20 planning documents (ERP domain `01–05, 11–12`; platform `03, 09`; experience `04, 07–08`; integrations `05, 10`; delivery `06` + 7 phase work orders). No code, no CI, no infra exist. Stack committed in docs: TypeScript/NestJS, Next.js 15/React 19, Prisma, PostgreSQL 16+RLS, Redis/BullMQ, S3, OpenAPI-first.

## 3. Target Architecture

This package (`01–30`): AI operating layer added **around** the unchanged ERP — orchestrator + registry, decision engine, policy-as-data autonomy engine (L0–L5), tool layer as sole write path, pgvector RAG with permission-filtered retrieval, reporting engine, AI audit tables, AI Command Center, 10 ADRs, 9-phase roadmap with shadow→draft→execute→predictive autonomy ramp.

## 4. Major Gaps (from current state)

1. No implementation exists — every Phase 0–9 deliverable is open.
2. No eval harness or golden data yet (AI quality depends on it).
3. RAG corpus empty; extraction schemas need real tenant documents to harden.
4. No measured AI cost baseline (`28 §5` explicitly defers).
5. State-profile RERA content needs per-state legal validation before Phase 4.
6. Ops staffing (AI ops/on-call) undefined as an org matter.

## 5. Critical Risks (see `29` for all 17)

Top three: **R6 automation bias** (humans rubber-stamping AI approvals — mitigated by evidence cards + retro-audits but ultimately cultural), **R7 RERA state divergence**, **R12 scope creep** across a broad ERP + AI program.

## 6. Security Risks

Prompt injection via documents (controlled: untrusted-data handling, schema-only tool actions, red-team gates); authorization gaps for agent identities (controlled: same policy engine, fuzz-tested); provider data leakage (controlled: masking, no-training terms, regional routing); approval spoofing via messaging (controlled: MFA step-up, server-verified identity). Residual security risk after controls: **Low**; verified only after Phase 6/7 red-team evidence.

## 7. AI Risks

Hallucinated financials (structurally prevented: LLM never computes money), unsafe recommendations (confidence routing + L5 list), model/provider failure (failover + deterministic fallback), quality regression (pinned versions + eval replay), cost overrun (gateway budgets). The honest residual: recommendation **quality** in ambiguous field situations — mitigated by evidence requirements and human judgment, measured by adoption/precision KPIs from Phase 8.

## 8. Data Risks

Migration quality from legacy spreadsheets (import kit + shadow parallel), escrow/statutory integrity (deterministic invariants, golden tests), analytics drift from OLTP (snapshot as-of stamping), cross-tenant leakage (RLS + probes — proven, not assumed).

## 9. Scalability Risks

Single-Postgres ceiling (documented thresholds + extraction path); AI storm loads (queue classes, concurrency caps, budget gates); embedding index memory (sized; re-index procedure). Scale headroom targets defined for 50 tenants (`03 §4`).

## 10. Recommended Technology Decisions

All within the existing stack: NestJS monolith + worker separation for AI (ADR-AI1), pgvector (ADR-AI4), policy-as-data autonomy (ADR-AI3), LLM gateway (ADR-AI8), deterministic-first agents (ADR-AI5), unified approvals (ADR-AI2), REST+SSE (ADR-AI6). **No new infrastructure paradigm is introduced.** Specific model vendors are deliberately policy, not architecture (`28 §2`).

## 11. Migration Strategy

Greenfield with phased delivery: Phases 0–5 build the ERP (AI read-only shadow begins Phase 6 on real data), Phases 6–8 ramp autonomy through eval gates, Phase 9 hardens. Anchor tenant onboards via import kit + 4-week shadow parallel with reconciliation gates (`../../06 §4`, `26 §4`).

## 12. Implementation Priority

1. ERP money-path correctness (demands/escrow/approvals) — trust foundation.
2. Construction planning + site ops (AI's data fuel).
3. Governance rails (policy engine, audit tables, eval harness) **before** any agent write.
4. High-ROI agents first: Billing Verification, Material Intelligence, Progress, Management Intelligence.
5. Predictive features last, on measured baselines.

## 13. Production Readiness

`26` checklist: 0 of ~30 items checkable today. MVP exit (ERP live, AI shadow) achievable end of Phase 6 (~week 36); full AI-operated production requires Phase 9 (~week 46) with §26 complete including red-team and DR evidence.

## 14. Final Recommendation

Proceed to implementation following `27` exactly, with the binding rule that **AI autonomy is earned, not shipped**: no agent write occurs until the policy engine, audit chain, and eval harness are proven on staging, and no L4 class is enabled without per-tenant sign-off of the autonomy policy. The architecture deliberately trades AI "wow" for auditability and money-correctness — correct for construction, where a wrong rupee is harder to reverse than a wrong sentence.

## 15. Architecture Score

```
Architecture Score
------------------
Domain Model:       8/10   (complete lifecycle + hierarchies; JV/JD land economics deferred, flagged)
ERP Architecture:   8/10   (bounded contexts, invariants, contracts defined; unproven until built)
AI Architecture:    8/10   (strong governance model; eval/cost baselines pending real data)
Security:           8/10   (defense-in-depth + AI plane; VAPT/gates pending)
Scalability:        7/10   (headroom documented; single-DB + pgvector ceilings accepted with paths)
Observability:      8/10   (AI ops + traces designed; dashboards unproven)
Testing:            7/10   (strategy incl. AI evals strong; zero tests exist)
Production Ready:   2/10   (documentation-only repo — nothing deployable exists)
Overall:            7/10   (an implementable blueprint; production readiness is earned in Phases 0–9)
```
Scores are deliberately critical: the design is strong; the *system* does not exist yet. Nothing above 8 is claimable without execution evidence.
