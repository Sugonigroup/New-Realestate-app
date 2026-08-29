# Phase 5 — Marketing + Analytics + AI Automation (Weeks 27–32)

**Work order.** Depends on Phases 1–4 (event history + data). Covers `01 §M4, §M12`. Self-contained for execution.

## Goal

Closed-loop marketing ROI; executive + departmental dashboards; AI services in production (scoring, collections priority, copilot, document AI, QPR/site-report drafts). Exit demo: spend a mock ₹10L across 4 channels → attribution to bookings; CFO asks copilot "collections due this week in Bengaluru residential" and gets a scoped answer.

## Work packages

### WP-5A Marketing module (agent)
- Campaign master (channel/budget/project/segment), spend ingestion (Meta + Google Ads API sync, manual bills), creative library with approval + usage-expiry + RERA reg-no check on external creatives (BR-C hook from 4A), launch playbook module (waitlist, EOI with token + refund SLA, announcement journeys).
- Attribution: UTM enforcement, lead→opportunity→booking closed-loop; CPL/CPV/CPB/CAC by source/campaign/creative; first/last/linear views; source-quality scorecard feeding CRM scoring.
- Accept: seeded 4-channel spend attributes correctly to 25 bookings under all 3 models; creative without reg-no fails publish.

### WP-5B Data platform & semantic layer (agent)
- ELT: nightly + CDC-lite (event-sourced marts) into warehouse (start Postgres read-replica marts; ClickHouse behind same interface when >50GB); semantic layer (cube-style metric definitions: revenue, collections, demand, inventory, cost, headcount) with RBAC row-scopes mirrored.
- Accept: metric definitions return identical values to source-of-truth spot checks (5 metrics × 3 projects).

### WP-5C Dashboards (agent)
- Executive cockpit (portfolio KPIs, forecast vs plan, risk flags, drill-through to source screens); department dashboards per `04 §4`; scheduled report packs (board pack, lender pack, weekly sales) as PDF via email/WhatsApp with template engine.
- Accept: board pack generated on schedule with 12 sections populated; drill-through deep-links work.

### WP-5D AI services (agent)
- LLM gateway (provider-agnostic router, PII-masking middleware, tenant AI-feature flags, per-tenant data-use consent).
- Lead scoring ML v2 (train on Phase 1+ data; fallback rules v1); collections-priority model (propensity × value ranking for CRM calling lists); document AI (vendor invoice extraction → 3-way match auto-accept ≥ confidence threshold; KYC extraction hardening).
- Copilot: NL → semantic-layer queries, permission-scoped, cited to screens; "no data access" fallback; audit of every query.
- Auto-drafting: QPR narrative paragraphs, daily site report summaries, dunning escalation memos — all human-confirmable (drafts, never auto-send).
- Accept: copilot answers 20 scripted questions with correct scoping (cross-project attempts blocked); invoice auto-accept rate ≥80% on seeded set with zero wrong-amount accepts.

### WP-5E Automation hardening (agent)
- "Minimum human involvement" audit: instrument touchless-rate metrics per flow (lead ack, demand, reminder, recon, commission, QPR); expand journey coverage (booking anniversary, possession pipeline, vendor payment status push); SLA dashboards per automated flow; failure→task auto-creation rules.
- Accept: dashboard shows touchless % for 8 core flows; 3 new journeys live end-to-end.

## §Contract
Warehouse interface stable (semantic metric YAML); AI gateway port `AiPort.complete(task, context)`; consent gate enforced before any AI use of customer data.

## Exit demo (PO script)
Marketing ROI screen with 4 channels; exec cockpit drill to a lagging project; copilot Q&A with permission denial demo; invoice OCR auto-accept shown; touchless-rate dashboard reviewed with PO; board pack PDF delivered.

## Done when
All WP acceptance green; AI outputs audit-logged; cost tracking for LLM/WhatsApp live; PO demo executed.

## Effort budget
**500 person-hours** (ERP analytics/marketing scope only; AI-agent work moved to roadmap Phases 6–8) — WP-5A 140 · WP-5B 120 · WP-5C 140 · WP-5E 60 · integration/demo 40. Baseline: `docs/architecture/31-effort-estimation.md`.
