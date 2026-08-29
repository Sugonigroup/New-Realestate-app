# Phase 2 — Finance Core + Customer Portal + Payments (Weeks 11–16)

**Work order.** Depends on Phase 1 (bookings, schedules, events). Covers `01 §M7` (demand→receipt→ledger→escrow→sync) and `§M10` (buyer portal). This file is self-contained for execution.

## Goal

Milestone-driven demand → WhatsApp reminder → payment link → auto-receipt → ledger; escrow classification per the 70% rule; buyer self-service portal live; Tally voucher sync working in sandbox. Exit demo: a real booking's next milestone is demanded, paid via UPI sandbox, receipted, ledgered, and visible on the buyer's portal.

## Work packages

### WP-2A Demand engine (agent)
- Auto-demand on `milestone.certified` (mock trigger until Phase 3) + manual/bulk generation with exception preview (plan↔milestone mapping gaps).
- Demand numbering (gapless per entity, BR-L), demand PDF (template), interest engine (configurable rate, monthly posting, RERA-cap aware), allocation rules (FIFO oldest demand), customer ledger service (unit-level running account, statement PDF/WhatsApp).
- Dunning jobs: T-7/T-3/T-0 WhatsApp+email with Pay-Now deep link; T+7 escalation to CRM exec task.
- Accept: golden tests — demand amounts incl. interest to the paise across 10 scenarios; dunning fires exactly once per step (idempotent).

### WP-2B Payments & receipts (agent)
- Razorpay adapter: payment links/pages, `payment.captured` webhook → idempotent receipt creation; instrument registry (gateway, NACH mandate status, RTGS/NEFT, cheque with PDC register, cash with BR-K ₹2L block).
- eNACH mandate lifecycle: create/sign (sandbox), debit scheduling from demand calendar, failure retry ladder + dunning, mandate status per unit.
- Receipts: clearing states (pending→cleared/bounced), bounce workflow (charges + re-demand), receipt PDF + WhatsApp ack.
- Bank recon: statement upload (CSV/MT940) → matcher (amount/date/UTR fuzzy) → exceptions queue; gateway auto-recon job.
- Accept: recon matcher ≥98% on seeded 500-line statement; duplicate webhook test creates exactly one receipt.

### WP-2C Escrow & 70% rule (agent)
- Escrow accounts per project (designated account registry), auto-classification of cleared receipts into escrow buckets, utilisation dashboard (70% gauge), withdrawal request workflow (amount vs certified % guard) with Form 3/4 certificate attachments, breach alerts (compliance event + CFO notification).
- Accept: breach simulation alert fires; withdrawal blocked when certified % insufficient.

### WP-2D Customer portal (agent)
- Next.js app: OTP login (WhatsApp/SMS), home (progress hero placeholder, next due card), payments (schedule, pay now via PG, eNACH setup), receipts & statements, documents (AFT status, receipts), service request stub, notification preferences + consent center (DPDP).
- PWA: manifest, offline shell, push stub. Launch-day mode: read-heavy caching, queue-position page reuse from Phase 1 stub.
- Accept: buyer can pay sandbox UPI and see receipt <10s; Lighthouse ≥90; consent toggles honored within 1 message cycle.

### WP-2E Accounting sync & AP seed (agent)
- Tally connector (sandbox): voucher push for sales/receipts/PVs with control totals + recon report + period lock respect; Zoho Books adapter interface behind same port.
- AP seed for Phase 3: vendor invoice ingest endpoint + approval workflow hooks (no RA logic yet).
- Accept: 100 seeded vouchers reconcile in Tally sandbox; closed-period attempt rejected.

### WP-2F Collections console (agent)
- Finance UI: demands (generate/manage), collections inbox (instrument capture, recon exceptions), customer ledger timeline, aging report, refund workflow (cancellation refunds from Phase 1 events with interest calc, SLA tracking).
- Accept: aging matches ledger; refund E2E posts to escrow/outflow correctly.

## §Contract
Events consumed: `milestone.certified.v1` · Events emitted: `demand.generated.v1`, `receipt.cleared.v1`, `receipt.bounced.v1`, `escrow.breach.v1`, `refund.completed.v1` · Ports: `PaymentGatewayPort`, `BankReconPort`, `AccountingSyncPort`.

## Exit demo (PO script)
Certify mock milestone → demand generated + PDF → buyer gets WhatsApp T-7 → opens portal → pays ₹2,50,000 UPI sandbox → receipt instantly → ledger updated → commission accrual event from Phase 1 fires → CFO sees escrow gauge move → Tally shows receipt voucher → recon shows matched line.

## Done when
All WP acceptance green; money-correctness suite (03 §8) at 100% pass; webhook signature tests; runbooks for PG/WhatsApp failure; PO demo executed.

## Effort budget
**760 person-hours** — WP-2A 140 · WP-2B 160 · WP-2C 80 · WP-2D 160 · WP-2E 100 · WP-2F 80 · integration/demo 40. Baseline: `docs/architecture/31-effort-estimation.md`.
