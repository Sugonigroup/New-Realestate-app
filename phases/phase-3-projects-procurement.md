# Phase 3 — Project Management + Procurement (Weeks 15–22)

**Work order.** Depends on Phase 2 (demand engine consumes `milestone.certified`). Covers `01 §M5–M6`. Self-contained for execution.

## Goal

Real milestone certification triggers real demands; schedule/progress/QC live; procurement loop indent→RFQ→work order→RA bill→payment run closes; vendor portal live. Exit demo: PM certifies "8th slab" with photos → finance demand auto-fires; a RA bill goes through 3-way match to payment run with deductions.

## Work packages

### WP-3A Project setup & approvals register (agent)
- Land parcel & title records; approvals register (sanctioned plan, EC, fire NOC, CC, OC) with expiry alerts + conditions; drawing/document control (revision distribution + acknowledgment); sanctioned-vs-revised plan versioning with RERA change tracking.
- UI: project master (segment-aware templates), approvals register with expiry chips, drawing list.
- Accept: expiry alert job fires T-30; superseded drawing blocks RA bill reference test.

### WP-3B Schedule & WBS (agent)
- Activity library per segment (residential high-rise seed: 120+ activities with dependencies); WBS editor; baseline vs current; critical path (CPM); delay events with reason codes; Gantt UI (SVG renderer per 04 §2).
- Milestones: types (payment-plan, RERA-committed, lender-drawdown), mapping to plan milestones, certification workflow (Site Eng → PM → Structural/Architect certificate attach → `milestone.certified.v1` → demand).
- Progress: planned-vs-actual %, EVM (PV/EV/AC, SPI/CPI) computed nightly, daily site report (field PWA: photos with geo, manpower, weather, blockers) + weekly digest.
- Accept: CPM correct on seeded 120-activity network (known answer); certification→demand integration test from Phase 2.

### WP-3C QC, snags & HSE (agent)
- QC checklists per stage (RCC pour card etc.), NCR, snag register (internal + customer handover) with kanban, third-party lab records; HSE: observations, toolbox talks, incidents with severity, contractor safety scorecard.
- Accept: pour-card approval gates slab milestone certification (configurable rule) test.

### WP-3D Vendor master & sourcing (agent)
- Vendor master (types, GST/PAN/PF/ESIC/CLRA docs with expiry, blacklist), compliance gate on work orders (BR-I), vendor rating (quality/schedule/safety rollups).
- Sourcing: indent (from PM or stores) → RFQ (BOQ items) → response (portal) → comparative statement (L1 highlight) → approval → LOI/Work Order/PO with terms (retention %, mobilisation advance, DLP, RA cycle, escalation).
- UI: sourcing pipeline, comparison sheet, work order detail (BOQ, SOE).
- Accept: compliance-gate test (expired CLRA blocks WO); comparison math exact.

### WP-3E RA bills & measurements (agent)
- RA bill entry (vendor portal or back-office), measurement book entries (joint measurement), deductions matrix (retention, TDS 194C, GST RCM self-invoice, advance recovery, material issue recovery, LD) computed from effective-dated rates, 3-way match (WO/BOQ ↔ MB ↔ bill) with exception queue, approval workflow (authority slabs), net payable.
- Accept: deductions golden tests; 3-way mismatch routes to exception queue not approval.

### WP-3F Materials & stores (agent)
- Material master, central + site stores, GRN, issue to contractor/WO, stock ledger (FIFO), min-max replenishment alerts, cement bag tracking, steel heat-number traceability, physical verification variance report.
- Accept: stock ledger invariant tests (never negative without override approval); variance report matches ledger.

### WP-3G Vendor portal (agent)
- RFQ inbox + response, work order view, bill submission wizard (docs + OCR stub), payment status, compliance doc upload.
- Accept: vendor submits bill → appears in finance exception/approval queue with extracted fields.

### WP-3H Payment runs (agent)
- AP payment run: select approved payables (RA bills, invoices, advances) → maker run → CFO release (checker) → Razorpay X payout or bank file (NEFT/RTGS batch) → advice → voucher sync; retention release workflow; advance ledger.
- Accept: maker-checker enforced; partial payment allocation correct; payment advice WhatsApp to vendor.

## §Contract
Events: `milestone.certified.v1` (real producer), `rabill.approved.v1`, `rabill.paid.v1`, `material.issued.v1`, `progress.updated.v1` · Ports: `PayoutPort`.

## Exit demo (PO script)
Open Gantt → certify 8th slab with photos → finance demand auto-generated → indent→RFQ→3 quotes→WO approval → vendor submits RA bill on portal → 3-way match clean → deductions preview (retention+TDS+RCM) → approval → payment run maker/CFO → payout sandbox → advice → Tally voucher.

## Done when
All WP acceptance green; EVM/critical-path unit suites; load test of inventory+schedule reads; PO demo executed.

## Effort budget
**1,000 person-hours** (largest phase) — WP-3A 80 · WP-3B 200 · WP-3C 120 · WP-3D 120 · WP-3E 140 · WP-3F 120 · WP-3G 80 · WP-3H 80 · integration/demo 60. Baseline: `docs/architecture/31-effort-estimation.md`.
