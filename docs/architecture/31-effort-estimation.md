# 31 — Effort Estimation (Bottom-Up, Per Work Package)

Bottom-up estimate for building the BuildOS web application (ERP + AI layer) from the phase work orders (`../../phases/`) and the AI roadmap (`27-implementation-roadmap.md`). **Supersedes** the order-of-magnitude figure in `../../06 §7` (which was a lean-scope, engineering-only estimate); this file is the planning baseline.

## 1. Method & assumptions

- Unit: person-hours (1 person-week = 40 productive hours).
- Budgets **include**: implementation, unit/integration tests per `25`, code review, migrations, OpenAPI updates, and the per-WP acceptance criteria + demo prep from the work orders.
- Budgets **exclude**: tenant data-migration execution (in Phase 9), third-party vendor costs (WhatsApp/PG/eSign/LLM tariffs), ongoing support after go-live, and content/config onboarding of the tenant.
- Ranges: per-phase totals carry **±15%** uncertainty; work-package figures are midpoints.
- Contingency 10% held at program level, released per phase exit (not per task).

## 2. Phase 0 — Foundations (≈920 h)

| WP | Scope | Hours |
|---|---|---|
| WP-0A | Monorepo, tooling, money-utils, permissions codegen | 60 |
| WP-0B | Terraform infra, CI/CD, previews, observability wiring | 100 |
| WP-0C | Core API skeleton, RLS guard, outbox, BullMQ, seed tenant | 120 |
| WP-0D | Identity (OTP/MFA/sessions) + RBAC/ABAC + admin screens | 140 |
| WP-0E | Workflow engine + My Approvals + designer-lite | 120 |
| WP-0F | Document vault (S3, versions, watermark) + audit trail | 90 |
| WP-0G | Design system + ERP shell (context bar, ⌘K, role-filtered IA) | 160 |
| WP-0H | Notification hub plumbing (templates, journeys v1, consent) | 90 |
| — | Phase integration, RLS/authz suites, exit demo | 40 |

## 3. Phase 1 — CRM + Sales + Notifications (≈860 h)

| WP | Scope | Hours |
|---|---|---|
| WP-1A | CRM core (ingestion, dedup, routing, inbox, kanban, visits) | 200 |
| WP-1B | Journeys + rules-based scoring v1 | 80 |
| WP-1C | Inventory, pricing engine, payment-plan schedule generator | 160 |
| WP-1D | Bookings wizard, holds, AFT + eSign, cancellations/refunds | 180 |
| WP-1E | Channel partners + commission engine + payout batches | 140 |
| WP-1F | Sales ops dashboards + daily report + launch queue | 60 |
| — | Integration, money golden-files (schedule), exit demo | 40 |

## 4. Phase 2 — Finance + Customer Portal (≈760 h)

| WP | Scope | Hours |
|---|---|---|
| WP-2A | Demand engine, interest, ledgers, dunning journeys | 140 |
| WP-2B | Razorpay/eNACH, receipts, bounces, bank recon matcher | 160 |
| WP-2C | Escrow classification, 70% gauge, withdrawal workflow | 80 |
| WP-2D | Customer portal (OTP, payments, docs, consents, PWA) | 160 |
| WP-2E | Tally/Zoho sync + control totals + AP seed | 100 |
| WP-2F | Collections console + aging + refunds | 80 |
| — | Integration, recon golden tests, exit demo | 40 |

## 5. Phase 3 — Projects + Procurement (≈1,000 h)

| WP | Scope | Hours |
|---|---|---|
| WP-3A | Project setup, approvals register, drawings control | 80 |
| WP-3B | WBS/activities, CPM + Gantt, milestones + certification chain, EVM, daily reports | 200 |
| WP-3C | QC checklists/pour cards, NCR, snags, HSE | 120 |
| WP-3D | Vendor master + compliance gates + RFQ→comparison→WO | 120 |
| WP-3E | RA bills, measurement book, deductions matrix, 3-way match | 140 |
| WP-3F | Materials, GRN, stock ledger, site stores, variance | 120 |
| WP-3G | Vendor portal | 80 |
| WP-3H | Payment runs (maker-checker), retention, advances | 80 |
| — | Integration (certification→demand E2E), exit demo | 60 |

## 6. Phase 4 — RERA/Compliance + HR (≈720 h)

| WP | Scope | Hours |
|---|---|---|
| WP-4A | RERA registry + disclosure mirror APIs | 60 |
| WP-4B | QPR engine (auto-fill, state schemas, maker-checker, filings) | 140 |
| WP-4C | Statutory calendar + health dashboard | 80 |
| WP-4D | Complaints + litigation register | 60 |
| WP-4E | DPDP consent ops + DSAR workflows | 40 |
| WP-4F | HR core, geo-attendance, leave | 120 |
| WP-4G | Payroll + sales incentive engine | 160 |
| WP-4H | Contractor labour muster + CLRA compliance | 60 |
| — | Integration, consultant validation support, exit demo | 60 |

## 7. Phase 5 — Marketing + Analytics (≈500 h)

| WP | Scope | Hours |
|---|---|---|
| WP-5A | Campaigns, spend sync (Meta/Google), attribution, launch playbooks | 140 |
| WP-5B | KPI snapshot marts + semantic layer + RBAC mirrors | 120 |
| WP-5C | Dashboards D1–D12 + report packs (D-numbers per `../../08`) | 140 |
| WP-5E | Automation hardening (touchless metrics, extra journeys) | 60 |
| — | Integration, exit demo | 40 |

**ERP subtotal (Phases 0–5): ≈4,760 h** (midpoints, engineering) + shared overhead below.

## 8. Phases 6–9 — AI layer + hardening/go-live (≈3,220 h)

| WP | Scope | Hours |
|---|---|---|
| P6 | Orchestrator, agent registry, policy engine (L0–L5) | 180 |
| P6 | LLM gateway (routing, masking, budgets, caching) | 120 |
| P6 | pgvector RAG: ingestion, OCR/parsers, chunking, retrieval API | 200 |
| P6 | Shadow agents: Progress (80), Material Intelligence (80), Billing Verification (100) | 260 |
| P6 | Eval harness + golden sets (extraction, routing, injection corpus) | 120 |
| P6 | AI Command Center (read-only) + AI tables UI | 100 |
| P6 | Shadow infra, cost accounting, tracing for AI runs | 60 |
| P6 | Phase integration + shadow-exit demo | 60 |
| P7 | L3 execution + whitelists + rate caps | 80 |
| P7 | L4 approval cards (ERP + WhatsApp) + evidence chips | 120 |
| P7 | Remaining 9 agents (PM, Schedule, Procurement, Contractor, Cost, Quality, Safety, Document, Mgmt) | 440 |
| P7 | Ask-AI GA (scoped, cited) + journeys | 120 |
| P7 | Daily/weekly/monthly report generation GA | 80 |
| P7 | Red-team + autonomy-matrix negative tests | 80 |
| P7 | Phase integration + autonomy go/no-go demo | 60 |
| P8 | Shortage/delay prediction + backtesting | 160 |
| P8 | EAC forecasting + contractor risk scoring | 80 |
| P8 | Anomaly tuning + feedback loops | 80 |
| P8 | Copilot NL→semantic hardening | 80 |
| P8 | Phase integration + precision sign-off | 60 |
| P9 | VAPT closure + security hardening | 120 |
| P9 | Performance/load + failover game days | 120 |
| P9 | Data migration kit + importers + reconciliation | 160 |
| P9 | UAT support, runbooks, training, cutover, launch shadow | 280 |

## 9. Shared overhead (across all phases)

| Item | Hours |
|---|---|
| Embedded QA/SDET (test authoring, E2E suites, release gates) | 500 |
| DevOps/SRE (beyond WP-0B: envs, alerts, on-call setup, cost hygiene) | 300 |
| UX design (beyond Phase 0 system: module screens, portals, AI UX) | 300 |
| PO/domain support, UAT facilitation, training material | 250 |
| **Program contingency (10%)** | ~960 |
| **Overhead subtotal** | **≈2,310 h** |

## 10. Program totals

| Scope | Midpoint | Range (±15%) |
|---|---|---|
| ERP engineering (Phases 0–5) | 4,760 h | 4,000–5,500 |
| Shared overhead + contingency | 2,310 h | — |
| **ERP total (Phases 0–5)** | **≈7,070 h** | **≈6,200–8,100** |
| AI + hardening/go-live (Phases 6–9) | 3,220 h | 2,700–3,700 |
| **Full AI-operated platform (Phases 0–9)** | **≈10,290 h** | **≈8,900–11,800** |
| AI increment on a finished ERP (P6–8 only) | ≈2,540 h | 2,200–2,900 |

## 11. Calendar translation (elapsed weeks)

| Team | Full platform (10,290 h) | Notes |
|---|---|---|
| 6–10 eng (planned shape, 3 workstreams) | **44–48 wks** | matches `27` roadmap |
| 4 eng + 1 AI specialist | 60–70 wks | serialization risk on Phase 3/4 |
| 3 eng (lean) | 80–95 wks | MVP-first strongly advised; use thin-MVP scope (~2,200 h → 18–20 wks) |
| Agent-augmented (work orders executed by coding agents + human review) | **30–38 wks** | 25–40% compression; review/QA becomes bottleneck; contingency unchanged |

Compression rules: agent-executable packages (well-specified CRUD, UI, migrations, tests) compress 30–40%; money-correctness suites, security reviews, approval/autonomy gates, and integration demos do **not** compress — they gate.

## 12. Re-estimation & tracking

- Baseline at Phase 0 exit; re-estimate remaining phases at each phase exit using actual burn (earned-hours vs plan).
- Work orders carry per-WP budgets (added in each `../../phases/phase-*.md`); deviations >20% on a WP trigger re-estimation of the phase before continuation.
- Track in the same system as tasks (`../../07 §2`): every WP = tracked work with estimate vs actual.
