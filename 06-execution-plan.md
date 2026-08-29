# 06 — Execution Plan

**Elapsed target: ~38 weeks** with three parallel workstreams. Each phase has a standalone, agent-executable work order in `phases/` — hand the file to a coding agent (or run several agents on different work packages inside a phase) and merge via the acceptance criteria defined there.

---

## 1. Workstreams

| Stream | Scope | Runs |
|---|---|---|
| **WS-A Platform** | Monorepo, CI/CD, IaC, identity/RBAC, workflow engine, docs vault, notification hub, audit, integrations spine | Phases 0–2 heavy, then support |
| **WS-B Business modules** | CRM → Sales → Finance → Projects → Procurement → Compliance → HR → Marketing → Analytics | Phases 1–5 |
| **WS-C Experience & portals** | Design system, ERP shell, customer/partner/vendor portals, field PWA, AI UX | Phases 0–5 |

Dependencies are strict only where noted; inside a phase, work packages are parallelizable.

> **Supersession note (AI-operated architecture):** `docs/architecture/27-implementation-roadmap.md` extends this 7-phase plan to **9 phases** (adding AI-agents Phase 6, AI-automation Phase 7, predictive Phase 8, and moving production hardening to Phase 9, ~46 weeks). Phases 0–5 work orders below remain the detailed ERP specs; AI autonomy is enabled only through the shadow→draft→execute ramp with eval gates defined there. The AI operating layer is specified in `docs/architecture/07–10`.

## 2. Phase map

| Phase | Weeks | Title | Exit criterion (demo-able) |
|---|---|---|---|
| **0** | 1–4 | Foundations | "Login → tenant/project switch → permission-filtered shell → audit trail" works on staging infra with CI/CD |
| **1** | 5–12 | CRM + Sales + Notification Hub | Lead from Meta → routed → visit → booking (with approval) → WhatsApp journey fires; commission accrues on mock receipt |
| **2** | 11–16 | Finance Core + Customer Portal | Milestone → demand → WhatsApp reminder → payment link → auto-receipt → ledger + Tally voucher; buyer pays on portal |
| **3** | 15–22 | Projects + Procurement | Gantt + milestone certification triggers demand; indent→RFQ→WO→RA bill→payment run end-to-end |
| **4** | 21–28 | RERA/Compliance + HR | QPR auto-drafts from real project/finance data; statutory calendar live; geo-attendance → payroll dry run |
| **5** | 27–32 | Marketing + Analytics + AI | Campaign ROI closed-loop; exec cockpit; lead scoring + collections priority + copilot in production |
| **6** | 31–34 | Hardening & Go-live | VAPT closed, load test at 500 rps, UAT sign-off, tenant onboarding runbook, live launch |

(Note: overlapping week numbers = parallel streams; the phase table is elapsed-time aligned.)

### Deep-dive → phase binding (mandatory references)

| Deep-dive | Implemented in | How |
|---|---|---|
| [07-micro-management.md](07-micro-management.md) | All phases | Task envelope (owner/SLA/next-action/checklist) is an acceptance criterion in every module WP; exception queues + checklist library scaffolded in Phase 0, populated per module |
| [08-dashboards.md](08-dashboards.md) | Phases 1–5 | D1/D2/D3 in Phase 2–3; D5/D6/D7 in Phase 3; D8/D9 in Phase 4; D4/D10 in Phase 1–5; D11/D12 with portals (Phase 2/3); panel registry (`dashboards.yaml`) built in Phase 5 WP-5C |
| [09-approval-system.md](09-approval-system.md) | Phase 0 (engine) + per module | WP-0E builds the engine per 09 §1–§5; each module phase seeds its authority-matrix rows (09 §2); WhatsApp approvals in Phase 2 WP-2B/B journeys |
| [10-integrations-sales-marketing.md](10-integrations-sales-marketing.md) | Phases 1–3, 5 | Rows 1–9, 13–14, 22–24 in Phase 1–2; 11–12, 15–17, 25–28 in Phase 2–3; 18–21, 29 in Phase 5 |
| [11-project-management-deepdive.md](11-project-management-deepdive.md) | Phase 3 | WBS templates, CPM, certification chain, EVM, QC/HSE are the spec for WP-3A–C |
| [12-rera-deepdive.md](12-rera-deepdive.md) | Phase 4 | State profiles, QPR field mapping, escrow withdrawal flow, Section 18 refunds, audit kit are the spec for WP-4A–E |

## 3. Team model (human + agent)

**Humans:** 1 product owner (domain expert: real estate ops), 1 architect/tech-lead, 1 designer, 1 QA lead + 1 SDET, 1 DevOps/SRE, compliance consultant (part-time: RERA/CA), engineering pod: 6–10 engineers **or** agent-augmented equivalents (each agent works one work package at a time under the tech-lead's review).

**Agent execution rules** (apply to all `phases/*.md` work orders):
1. One agent = one work package; work orders are self-contained (no prior conversation needed).
2. Agent must not change interfaces marked `§contract` without tech-lead approval; propose via ADR note in the PR.
3. Every package ends with: green tests, updated OpenAPI, migration files, updated docs, and a demo script that the PO can execute.
4. Merge gates: CI (lint/type/test/contract), code review (tech-lead), acceptance checklist in the work order.
5. **Concrete multi-agent division** — agent roster (13 roles), code-ownership map, parallel lanes, per-week dispatch schedule, and orchestration protocol: `docs/architecture/32-multi-agent-execution.md`.

## 4. Environments & release

- `dev` (ephemeral PR previews) → `staging` (UAT, seeded demo data incl. reference ₹500Cr tenant) → `prod` (ap-south-1).
- Trunk-based; feature flags per tenant; weekly release train with automated changelog; DB migrations expand-contract only (zero downtime).
- **Go-live strategy for the anchor tenant:** 4-week shadow period (run parallel with spreadsheets), module-by-module cutover: CRM+Sales → Finance demands → Projects → Procurement → HR. Data migration kit: Excel/CSV importers per master (leads, units, bookings, customers, vendors, employees) with validation reports.

## 5. Definition of Done (global)

- Code: typed, linted, tests per `03 §8` gates, OpenAPI updated, migrations reviewed.
- Security: authz matrix row added (role × endpoint), PII classifier run on new fields, audit events on all writes.
- Ops: dashboards/alerts for new queues & endpoints, runbook entry, feature flag.
- Product: PO-verified demo script, user-guide section, permission template updated.
- Compliance: RERA/DPDP checklist item updated when in scope.

## 6. Risk register (top 8)

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | RERA rule variance across states (forms, rates, process) | Legal exposure | State-config model from day 1; compliance consultant validates each state template; QPR as structured data + human submit |
| R2 | Booking-day load spikes | Lost sales, reputation | Queue + read-path caching + load test in every release for launch flows |
| R3 | WhatsApp template rejections / policy changes | Comms outage | Template redundancy, SMS/email failover chain, BSP abstraction |
| R4 | Scope creep (ERP breadth) | Timeline blowout | Phase exit criteria frozen; backlog parked in `phase-5/6` or post-GA |
| R5 | Tally sync fidelity | Finance trust | Control totals, recon screen, parallel-run 4 weeks |
| R6 | Data migration quality (legacy spreadsheets) | Dirty go-live | Import kit with validation reports + shadow-period reconciliation |
| R7 | Single-DB scaling ceiling | Later rework | Growth thresholds documented (02 §6); read replica + warehouse offload; context extraction path (ADR-01) |
| R8 | Key-person/domain-knowledge loss | Slowdown | This doc set + ADRs + demo scripts as living spec; every work order self-contained |

## 7. Budget & effort envelope (planning estimate)

> **Superseded by the bottom-up baseline:** `docs/architecture/31-effort-estimation.md` — ERP (Phases 0–5) ≈7,070 h incl. overhead; full AI-operated platform (Phases 0–9) ≈10,230 h (range 8,900–11,700); per-WP budgets are embedded in each `phases/phase-*.md`. The earlier figure below is retained as the lean, engineering-only lower bound.

- Effort: ~3,800–4,600 engineering hours (6–10 eng × 38 weeks × factor), plus QA/DevOps/design/PO.
- SaaS infra at anchor-tenant scale: ~₹2.5–4 L/month (AWS + vendors) before scale-out.
- Third-party runtime costs scale with usage: WhatsApp conversations (Meta per-conversation pricing), SES/Postmark, Razorpay MDR, eSign per document, OCR pages.
