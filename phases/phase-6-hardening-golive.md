# Phase 6 — Hardening, UAT & Go-Live (Weeks 31–34 + 4-week shadow)

**Work order.** Depends on all phases. Self-contained for execution.

## Goal

Production-grade: security/perf gates closed, UAT signed, anchor-tenant data migrated, module-by-module cutover completed. Exit: live usage of CRM+Sales+Finance by the anchor tenant with shadow parallel.

## Work packages

### WP-6A Security hardening (agent + external VAPT)
- Close OWASP ASVS L2 checklist; VAPT engagement (external vendor) → triage → fix → retest; authz matrix full sweep (all roles × all endpoints); RLS cross-tenant suite final; secrets rotation drill; PII inventory final; DPDP readiness sign-off pack.
- Accept: zero criticals/highs open; sign-off pack complete.

### WP-6B Performance & resilience (agent)
- k6 load: 500 rps read burst 15 min + booking queue 1,000 concurrent; fix bottlenecks (index sweeps, cache); failover game day (WhatsApp outage→SMS, PG webhook replay, Redis failover, AZ drill); backup restore drill (RPO/RTO evidence).
- Accept: SLOs met per `02 §6`; game-day report with issues closed.

### WP-6C Data migration kit (agent)
- Importers: leads, customers, units/inventory, active bookings + schedules, demands/receipts opening balances, vendors + open POs/RA bills, employees + attendance, projects + schedules; Excel/CSV templates with validation reports (reject reasons, totals reconciliation); dry-run mode.
- Accept: anchor tenant's sample data imports with reconciliation report matching control totals; dry-run→commit flow.

### WP-6D UAT (agent support, PO-led)
- Staging seeded with migrated copy; UAT scripts per module (from exit demos); defect triage SLA; sign-off matrix per module owner.
- Accept: all P0 defects closed; sign-off matrix complete.

### WP-6E Go-live runbooks & cutover (agent)
- Cutover plan (module order per `06 §4`): freeze windows, migration run, smoke tests, hypercare rota (2 weeks), rollback plan per module; support model (L1/L2 definitions, escalation), training material (role-based quick guides, videos), tenant onboarding runbook (for SaaS scale: new tenant in <1 day).
- Accept: cutover checklist executed on staging fully; training kit reviewed by PO.

### WP-6F Launch (team)
- Shadow period: 4 weeks parallel-run (spreadsheets vs BuildOS) with reconciliation dashboards (collections, bookings, escrow) — discrepancies <0.5% before each module cutover; launch-day war room for first booking push (queue monitoring).
- Accept: two consecutive weeks of reconciliation within tolerance → module cutover sign-offs.

## Done when
Anchor tenant live on CRM+Sales+Finance; dashboards green; VAPT report archived; retros + backlog for Phase 5/GA features (Marketing full, AI expansions, multi-tenant onboarding) filed.

## Effort budget
**680 person-hours** (= roadmap Phase 9) — VAPT closure 120 · performance/game days 120 · data migration kit 160 · UAT support + runbooks/training/cutover 200 · launch shadow 80. Baseline: `docs/architecture/31-effort-estimation.md`.
