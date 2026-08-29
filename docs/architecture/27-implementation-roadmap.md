# 27 — Implementation Roadmap (Phases 0–9)

Supersedes the 7-phase view in `../../06` by adding AI maturity phases; existing phase work orders remain the detailed specs for Phases 0–5 (mapping table below). ~46 weeks elapsed with 3 workstreams.

| Phase | Weeks | Objective | Key deliverables & acceptance |
|---|---|---|---|
| **0 — Repository stabilization** | 1–4 | Foundation infra + governance | Per `../../phases/phase-0` + add: policy-engine scaffold, `ai_*` schemas, LLM gateway stub, eval harness scaffold. Accept: shell demo + RLS/authz suites green |
| **1 — ERP foundation** | 5–12 | CRM + Sales + notifications | `../../phases/phase-1`. Accept: lead→booking→journey demo |
| **2 — (ERP contd.) Finance + portal** | 11–16 | Demand→receipt→escrow, customer portal | `../../phases/phase-2`. Accept: payment E2E, escrow guard |
| **3 — Construction management** | 15–22 | Planning, BOQ, site ops, procurement, inventory, contractors, quality, safety | `../../phases/phase-3` extended with quality/safety modules (11). Accept: milestone→demand; WO→RA bill→payment run |
| **4 — Compliance + people** | 21–28 | RERA/statutory, HR/payroll, documents | `../../phases/phase-4` + doc vault/OCR plumbing. Accept: QPR draft; payroll dry-run |
| **5 — Reporting & data platform** | 27–32 | KPI snapshots, semantic layer, dashboards D1–D12, marketing ROI | `../../phases/phase-5` (ERP part). Accept: board pack auto-generated |
| **6 — AI agents (foundation)** | 31–36 | AI layer live in **shadow** | Orchestrator, registry, policy engine, LLM gateway (routing/masking/budgets), pgvector RAG, Progress + Material + Billing-Verification agents in read/draft-only; AI Command Center read-only. Accept: eval suites green; shadow runs produce correct insights on staging; zero tool-writes |
| **7 — AI automation** | 35–40 | Controlled autonomy | L3 execution enabled (notifications, tasks, reports); L4 approval cards live (PO-draft, baseline, budget, PR); ask-AI GA; daily brief GA. Accept: approval E2E with evidence cards; autonomy-matrix tests; injection red-team clean; cost budgets enforced |
| **8 — Predictive intelligence** | 39–44 | Forecasts & scoring | Shortage prediction, delay prediction, EAC forecasting, contractor risk scores, copilot analytics (NL→semantic, scoped). Accept: precision targets (anomaly ≥80% verified, forecast MAPE tracked), adoption metrics |
| **9 — Production hardening** | 43–46 | Go-live | `../../phases/phase-6` + `26` checklist incl. AI section. Accept: VAPT clean, DR drill, UAT sign-off, anchor tenant live with AI in production autonomy tiers |

## Per-phase definition (prompt-required fields)

Each phase defines: **objective** (table), **modules** (map above), **dependencies** (previous phase exit), **database changes** (migration packs per `05`), **APIs** (`18 §1` surface grows per phase), **UI** (nav modules + D-numbers per `22`), **AI capabilities** (L0→L3→predictive ramp), **tests** (`25` gates per level), **acceptance criteria** (table + `26` checklist lines).

## Binding principles during execution

- Phases 0–5 ship **zero AI writes**; the ERP must stand on its own first (system-of-record credibility).
- AI autonomy expands only through: shadow → L2 drafts → L3 whitelisted actions → measured L4 assist; each expansion gated by eval + approval-analytics evidence (`10 §4`, `26 §3`).
- Any phase exit requires the global DoD (`../../06 §5`) + the phase-specific acceptance criteria above.
