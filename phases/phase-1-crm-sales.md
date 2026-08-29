# Phase 1 — CRM + Sales & Inventory + Notification Journeys (Weeks 5–12)

**Work order.** Builds the revenue engine front half. Depends on Phase 0 (identity, workflow, docs, notifications, shell). Read `../01-product-requirements.md §M2–M3` and `../03-backend-architecture.md §1` for rules; this file is self-contained for execution.

## Goal

Omnichannel lead → qualification → visit → booking (with approvals) → AFT draft; channel partner & commission accrual; WhatsApp/email journeys live. Exit demo: a Meta lead reaches booking with one approval, customer receives WhatsApp at every step, broker commission accrues on mock receipt.

## Work packages

### WP-1A CRM core (agent)
- Entities: `leads, contacts, opportunities, interactions, site_visits, journey_states` (see 02 §5).
- Ingestion service: normalizer (+91, email lower, name cleanup) → dedup engine (tenant-scoped rules: same phone+project=duplicate merge suggestion; different project=linked opportunity) → routing engine (rules: project/segment/language/round-robin with load balance) → SLA clock (first response 15 min WhatsApp / 2 h human).
- Sources: website widget endpoint (HMAC + rate limit), Meta Lead Ads poller, portal webhook adapter (generic JSON contract for 99acres/MagicBricks), manual import (CSV with validation report), IVR webhook stub.
- APIs + UI: lead inbox (omnichannel, dedup flags, SLA countdown), lead detail (timeline, WhatsApp thread, disposition capture), pipeline kanban (configurable stages), visit calendar + slot booking, bulk actions, assignment rules admin.
- Accept: E2E test — webhook lead appears <5s, deduped correctly, routed, SLA timer visible; CSV import report shows reject reasons.

### WP-1B Lead journeys & scoring v1 (agent)
- Journeys: instant WhatsApp ack, visit reminder T-1h, no-show recovery, warm nurture (D2/D7/D14), stale reactivation (30/60/90), festival offer (configurable).
- Scoring v1 (rules-based; ML later): source weight + budget fit + engagement + recency → 0–100 with explanation breakdown; nightly rescore job.
- Accept: journey simulation tests incl. quiet hours and opt-out; score changes reflected in inbox column.

### WP-1C Inventory & pricing (agent)
- Entities: towers/floors/units (RERA carpet + built-up + SBA), unit attributes (facing, view, parking), unit state machine (`available→held→blocked→booked→registered→cancelled`) with transition audit.
- Pricing: effective-dated price lists per tower/type; computation service (base + floor rise + view + PLC + EDC/IDC + club + corpus + GST preview) returning line-wise breakdown; price revision workflow (approval + effect date + RERA-display mirror).
- Payment plan templates: CLP/DPLP/PLP/custom milestones; schedule generator (booking date + plan → demand schedule preview) — pure domain package with property-based tests.
- APIs + UI: inventory explorer (filters, unit-state color map), unit detail (compute preview), plan template admin, price list admin with revision workflow.
- Accept: schedule generator golden tests (20 scenarios, exact paise); unit state illegal-transition test.

### WP-1D Bookings & AFT (agent)
- Booking flow: hold (SLA auto-release) → wizard (KYC capture with PAN/Aadhaar OCR stub → co-applicants → plan selection → discount request with authority matrix → payment capture stub (gateway in Phase 2) → confirm) → price-book snapshot immutable on confirm.
- Events: `booking.confirmed` → consumers: docs (AFT draft from approved template), notify (welcome + eSign link), commission (rule check), sales dashboards.
- AFT: template engine (variables from booking), eSign adapter (sandbox: Leegality; stub provider), stamp-duty checklist per state, executed copy vaulting, `aft.executed`.
- Cancellations/transfer: forfeiture matrix, refund computation (interest per AFT rate), unit release, clawback commission event.
- Accept: booking E2E with approval; snapshot immutability test; cancellation computes refund = schedule-with-interest − forfeitures exactly.

### WP-1E Channel partners & commissions (agent)
- Partner onboarding (KYC docs, RERA agent registration number, panel approvals per project), partner portal slice (inventory read per panel rules, lead import with credit windows, own bookings view).
- Commission engine: plan types (flat %, slab, scheme), credit rules (first/last-touch window), ledger accrual on `receipt.cleared` (Phase 2 event — wire with mock now), payout batch draft with TDS 194H, clawback on cancellation.
- UI: partner leaderboard, commission ledger, payout run (approval workflow).
- Accept: multi-touch scenario test — correct partner credited per window rules; clawback reverses ledger.

### WP-1F Sales ops dashboards (agent)
- Daily sales report auto-email (7:30 IST); funnel + velocity tiles; inventory ageing; cancellation rate; launch-day fair-queue stub (booking creation queued FIFO with position SSE).
- Accept: report generated on schedule with correct aggregates from seeded data.

## §Contract (do not change without ADR)
`POST /v1/leads` (ingestion) · `POST /v1/units/{id}/holds` · `POST /v1/holds/{id}/bookings` · events `lead.created.v1`, `booking.confirmed.v1`, `unit.cancelled.v1`, `commission.accrued.v1` · schedule-generator package API.

## Exit demo (PO script)
Meta sandbox lead → routed to exec → WhatsApp ack → visit booked by customer from WhatsApp list message → visit check-in → unit hold → booking wizard with 6% discount → Sales Head approves on mobile → schedule generated → welcome WhatsApp → AFT eSign sandbox link → partner commission accrual visible on mock receipt.

## Done when
All WP acceptance green; authz matrix rows added (sales roles × new endpoints); PII classifier run on lead/KYC fields; demo executed on staging by PO; import kit for leads/units validated with sample files.

## Effort budget
**860 person-hours** — WP-1A 200 · WP-1B 80 · WP-1C 160 · WP-1D 180 · WP-1E 140 · WP-1F 60 · integration/demo 40. Baseline: `docs/architecture/31-effort-estimation.md`.
