# 29 — Risk Register (Architecture & Business)

Scores: Likelihood × Impact (H/M/L). Owner roles per `../../06 §3`.

| # | Risk | L×I | Mitigation (already in architecture) | Residual |
|---|---|---|---|---|
| R1 | **AI acts beyond authority** (bug or policy gap) — unauthorized PR/PO/message | M×H | L0–L5 policy engine, tool allowlists, L5 registry rejections, service-identity scopes, negative tests in CI, kill-switches | Low |
| R2 | **Hallucinated recommendation adopted without check** | M×M | evidence-mandatory, citations, deterministic validators, confidence routing, approval analytics, adoption tracking | Low-Med |
| R3 | **Prompt injection via documents** (hostile vendor bill) | M×H | untrusted-data handling (15 §6), injection corpus, sandboxed parsing, tool-schema-only actions | Low |
| R4 | **LLM provider outage / tariff shock** | M×M | gateway failover, class routing, budgets, deterministic fallback, per-tenant premium toggle | Low |
| R5 | **Prompt-injection→data exfiltration** (cross-project) | L×H | RLS + retrieval scope joins + fuzz proof (16) | Low |
| R6 | **Human rubber-stamping of AI approvals** (automation bias) | M×M | evidence cards, MODIFY path, sample retro-audits (09 §8), approval-latency analytics, periodic L5 drills | Med |
| R7 | RERA state-profile divergence → compliance defect | M×H | state-profile config, consultant validation, disclosure mirror, audit kit (12) | Low-Med |
| R8 | Booking-day load spike | M×H | queue + burst design + k6 gates every release | Low |
| R9 | Single-Postgres ceiling at scale | L×M | replica offload, warehouse split, extraction path (ADR-01), scale NFRs (03 §4) | Low |
| R10 | Tally sync fidelity / finance trust | M×H | control totals, recon screen, parallel run (06 legacy) | Low-Med |
| R11 | Data migration quality from spreadsheets | M×M | import kit + validation + shadow reconciliation | Low-Med |
| R12 | Scope creep (ERP breadth) | H×M | frozen phase exits, roadmap gates (27), parked backlog | Med |
| R13 | AI cost overrun | M×M | budgets, routing, caching, chargeback visibility (28) | Low |
| R14 | Key-person / domain-knowledge loss | M×M | this doc set, self-contained work orders, ADRs, demo scripts | Low |
| R15 | WhatsApp/Meta policy or template rejection | M×M | template redundancy, channel failover chain, BSP abstraction | Low |
| R16 | Agent quality regression after model update | M×M | pinned prompt versions, eval regression replay, staged promotion (25 §4) | Low |
| R17 | Multi-tenant noisy-neighbor (AI storms) | M×M | per-agent concurrency caps, budget gates, queue priority classes | Low |

Top-3 watch items: R6 (needs culture + analytics, not just tech), R7 (regulatory), R12 (delivery discipline). Review cadence: monthly during build, per-phase exit, quarterly in operations.
