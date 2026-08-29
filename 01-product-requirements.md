# 01 — Product Requirements (PRD)

BuildOS — Real Estate Developer ERP, SaaS edition. Scope baseline: a **₹500 Cr/yr developer** as the reference tenant, designed to scale to ₹2,000 Cr without re-architecture.

---

## 1. Business context & scale assumptions

| Assumption | Value (reference tenant) |
|---|---|
| Annual revenue | ₹500 Cr (Ind AS 115 % completion method accounting) |
| Concurrent active projects | 10–14 (peak 25) |
| Cities | 4–6 (multi-state ⇒ multi-RERA, multi-stamp-duty) |
| Segments | Residential (3 sub-tiers), Commercial office/retail, Plotted, Mixed-use, Redevelopment/JV |
| Employees | 250–400 internal + 2,000–5,000 contract labour |
| Channel partners (brokers) | 500–1,500 registered, 150 active monthly |
| Homebuyers (active) | 3,000–5,000; cumulative database 25k+ |
| Unit bookings/year | 1,200–1,500; launches: 2–4 projects/yr |
| Marketing spend | ₹10–20 Cr/yr across digital, print, outdoor, events |
| Peak load | Launch-day booking open: 5,000 concurrent portal visitors, ~500 req/s burst |
| Compliance touchpoints | RERA QPR ×4/project/yr, GST monthly, TDS monthly, PF/ESIC monthly, lender stock statements quarterly |

**Product thesis — "minimum human involvement":** map every routine operation to an automated workflow, with humans only on exceptions and approvals:

| Today (manual) | In BuildOS (automated) |
|---|---|
| Lead spreadsheets, manual assignment | Portal/webhook capture → AI score → rule-based routing → WhatsApp auto-ack in <60s |
| Demand letters drafted in Word per milestone | Milestone certified in PM module → demand auto-generated → WhatsApp + email + payment link |
| Payment follow-up calls | Dunning journey T-7/T-3/T-0/T+7 with eNACH retry + promise-to-pay capture |
| Broker commission reconciled in Excel | Commission rules engine → auto-ledger on receipt → payout batch with TDS |
| QPR compiled manually each quarter | RERA module drafts QPR from PM/Finance data → human reviews → submit |
| Vendor bills matched by hand | OCR extraction → 3-way match (PO·GRN·bill) → exception queue → payment run |
| Site reports phoned in | Field app geo+photo progress → auto daily/weekly reports |
| Approvals chased on WhatsApp | Workflow engine with SLA timers, escalations, mobile approvals |

---

## 2. Personas

**Internal**
- **P1 MD / Promoter / CEO** — portfolio health, cash position, sales velocity, approvals (high-value).
- **P2 CFO / Finance Head** — collections vs demand, escrow compliance, cost variance, lender reports, GST/TDS.
- **P3 Project Director / Head — Projects** — schedule adherence, EVM, contractor performance, safety.
- **P4 Site Engineer / Site Manager** — daily progress, material issue, labour attendance, snag lists, QC.
- **P5 Sales Head / Sales Manager** — inventory, pricing, team pipeline, channel partner performance, launch readiness.
- **P6 Sales Executive / Pre-sales** — lead pipeline, site visits, bookings.
- **P7 CRM / Customer Relations Executive** — demands, receipts, complaints, handover, registration coordination.
- **P8 Marketing Manager** — campaign ROI, CPL, lead quality by source, creative approvals.
- **P9 Procurement / Stores Manager** — RFQs, POs, work orders, GRN, material accounting.
- **P10 Legal / Compliance Officer** — RERA registrations, QPR, approvals matrix (sanctioned plan, CC/OC), litigation, statutory calendar.
- **P11 HR Head / HR Executive** — payroll, attendance (incl. site), incentives, contractor labour compliance.
- **P12 Auditor / Banker (read-only)** — escrow utilisation, stock statements, audit trail review.

**External**
- **P13 Homebuyer (Customer Portal)** — payment schedule, receipts, progress photos, documents, service requests.
- **P14 Channel Partner (Partner Portal)** — live inventory, booking initiation, leads, commission dashboard.
- **P15 Vendor / Contractor (Vendor Portal)** — RFQ response, work order view, RA bill submission, payment status.

---

## 3. Module requirements

Legend: `M#` = module, `FR-x.y` = functional requirement (testable statement), `BR-x` = business rule. Priority: P0 = Phase 0–2 must-have, P1 = Phase 3–4, P2 = Phase 5+.

### M1. Platform Core (P0)

- FR-1.1 Multi-tenant SaaS: `tenant` = developer company. Isolation via shared DB + `tenant_id` Postgres RLS; per-tenant branding, domains (`erp.<brand>.in`), notification senders, WhatsApp numbers.
- FR-1.2 Org hierarchy: Tenant → Entity (SPV/company, legal accounting boundary) → Vertical (segment) → Project → Tower/Block → Floor → Unit. A project belongs to exactly one entity; reporting rolls up freely.
- FR-1.3 User management: SSO-ready auth (OTP + password + Google Workspace/LDAP optional), MFA (TOTP) for finance/admin roles, device sessions, forced logout, IP allowlist per role (optional).
- FR-1.4 RBAC+ABAC engine: configurable roles, permission strings `module.resource.action`, data scopes (All entities / assigned entity / assigned project / own records). Detailed model in `03-backend-architecture.md §4`.
- FR-1.5 Workflow engine: declarative state machines + approval chains with amount/value slabs, maker-checker (4-eyes), SLA timers, escalation, delegation (out-of-office), mobile approvals, full decision audit. **Full approval design: `09-approval-system.md` (authority matrices per action, WhatsApp approvals, SoD rules, approval analytics).** Micro-level management model (task envelope, checklists, exception queues): `07-micro-management.md`.
- FR-1.6 Document vault: S3-backed, versioned, folder taxonomy (per project: legal, approvals, drawings, RERA, agreements), tag search, OCR full-text, expiry tracking (approvals/licences), watermarking on download, permission-inherited access.
- FR-1.7 Audit log: immutable, append-only; who/what/when/where(IP)/before/after for every write; 7-year retention; export for auditors.
- FR-1.8 Master data & settings: currencies (INR paise-accurate), taxes, city/state master, approval matrices, numbering series (booking no., demand no., PO no. per entity), holiday calendars, e-signature authority list.
- FR-1.9 Feature flags per tenant; staging data cloning for UAT.

### M2. CRM (P0)

- FR-2.1 Omnichannel capture: web forms (embeddable widget), Meta Lead Ads, Google lead forms, portals (99acres, MagicBricks, Housing, NoBroker) via webhooks/email-parsing, IVR/call logs (Exotel/Ozonetel), walk-ins, referrals, partner-imported leads. Deduplication on phone(+91-normalised)/email per tenant (BR-2A: same phone+project = duplicate; different project = linked new opportunity).
- FR-2.2 AI lead scoring (0–100): source quality, budget vs segment fit, locality, engagement (opens/clicks/visits), recency; nightly re-score. Routing: round-robin within team by project/segment/language, with load balancing and reassignment on SLA breach (first response ≤15 min WhatsApp / ≤2 h human).
- FR-2.3 Pipeline: configurable stages `New → Contacted → Qualified → Site Visit Scheduled → Visited → Negotiation → Booking → Won/Lost` with reasons (price, location, inventory, finance, competitor). Kanban + list views, next-action enforcement.
- FR-2.4 Site visit management: slot calendar per project, WhatsApp self-booking link (bot), reminders T-1h/T-15m, visit check-in (geo), no-show recovery journey.
- FR-2.5 AI SDR bot (WhatsApp): greeting, 3–5 qualifying questions (segment, budget, timeline, loan), brochure/catalog share, visit booking, human handoff with transcript (P2, Phase 5).
- FR-2.6 Follow-up automation: nurture journeys by temperature (hot/warm/cold), festival offers, reactivation of stale leads (30/60/90-day), quiet hours (21:00–09:00 IST).
- FR-2.7 Competitor & requirement capture on lead; call dispositions; recordings linked.
- FR-2.8 Marketing attribution: source→campaign→UTM→lead→opportunity→booking closed-loop (see M4). Integration catalog for all lead sources: `10-integrations-sales-marketing.md §1`.

### M3. Sales & Inventory (P0)

- FR-3.1 Inventory tree: Project → Tower → Floor → Units with type (2/3/4BHK, shop, office, plot), carpet/built-up/super-built-up area (RERA carpet area is the legal basis), facing, views, parking slots, floor-rise attributes.
- FR-3.2 Pricing engine: base price list per tower/floor/type effective-dated, floor rise, view premium, PLC (preferential location charges), EDC/IDC, club charges, corpus fund, GST slabs, registration/stamp estimates. Price revisions with effect dates + RERA-compliant display.
- FR-3.3 Payment plans: templates (CLP construction-linked, DPLP down-payment, PLP possession-linked, subvention, custom milestones per segment); auto-compute demand schedule from plan + booking date + price.
- FR-3.4 Offers & holds: hold unit (SLA-locked, e.g., 24/48h), quote generation (PDF, versioned), discount workflow with authority matrix (BR-3A: >5% needs Sales Head, >8% CFO+MD; any discount below RERA-displayed price requires documented approval trail).
- FR-3.5 Booking: booking form → KYC (PAN/Aadhaar OCR) → booking amount payment (gateway/e-NACH/cheque capture) → provisional allotment → Allotment Letter (template-based PDF). Booking locks inventory (unit state machine: `Available → Held → Blocked → Booked → Registered → Cancelled`).
- FR-3.6 AFT (Agreement for Sale) generation from approved templates, eSign (Aadhaar eSign) journey, stamp duty workflow, witness capture, executed-doc vault. RERA Section 13 compliance.
- FR-3.7 Cancellations & transfers: forfeiture rules per policy matrix (BR-3B: RERA Section 18 refund with interest for builder-default; customer-exit forfeiture per AFT terms), auto refund computation, resale/transfer fee, unit back to inventory.
- FR-3.8 Channel partner management: partner onboarding + RERA agent registration capture, panel/approval per project, lead credit rules (first-touch/last-touch/window), commission plans (flat %, slab, scheme-based), commission ledger auto-credit on receipt clearance (BR-3C: commission payable only on realised amount), TDS 194H, payout batches, broker performance dashboard.
- FR-3.9 Sales operations: daily sales report (auto), launch-day booking queue (fair allocation), inventory ageing, sales velocity, cancellation rate, RERA-mandated disclosures mirror (booked/sold status).

### M4. Marketing (P1, Phase 3–4)

- FR-4.1 Campaign master: channel (Meta/Google/portal/outdoor/print/events/CRM-calls), budget, period, project, segment, creative assets with approval workflow.
- FR-4.2 Spend ingestion: Meta/Google Ads API auto-sync + manual bills; spend per campaign/day.
- FR-4.3 Attribution & ROI: CPL (cost/lead), CPV (cost/visit), CPB (cost/booking), CAC, lead→booking conversion by source/campaign/creative; multi-touch (first/last/linear) views.
- FR-4.4 Lead-source governance: UTM enforcement, honeypot/quality checks, junk-lead flagging, source-quality scorecard feeding CRM scoring.
- FR-4.5 Creative/asset library with usage rights expiry; brand kit per tenant.
- FR-4.6 Launch playbooks: pre-launch waitlist (interest capture + EOI), EOI/Pre-launch module (token collection with refund SLA), announcement journeys (WhatsApp/email/SMS). Marketing integration stack (Meta/Google Ads APIs, CAPI, GA4, social publishing, call tracking): `10-integrations-sales-marketing.md §3–4`.

### M5. Project Management (P0–P1)

- FR-5.1 Project setup: land parcel & title record, approvals register (sanctioned plan, environmental clearance, fire NOC, CC, OC — with expiry & conditions), sanctioned vs revised plan versioning (RERA change-approval tracking).
- FR-5.2 WBS & schedule: activity library per segment (residential high-rise, commercial, plots), dependencies, baseline vs current schedule, critical path, float, delay events with reason codes, resource loading. Gantt UI.
- FR-5.3 Milestones: contractual milestones mapped to (a) payment plan milestones (CLP), (b) RERA committed timeline, (c) lender-drawdown milestones. Certification workflow: Site Engineer → PM → Structural Consultant/Architect certificate → auto-triggers Finance demand + RERA progress update.
- FR-5.4 Progress tracking: planned-vs-actual %, EVM (PV/EV/AC, SPI/CPI), daily site report (mobile: photos, manpower count, weather, safety, blockers), weekly progress digest to management, time-lapse/photo evidence for QPR.
- FR-5.5 Quality: QC checklists per stage (RCC pour card, blockwork, plaster), snag/defect register (internal + customer handover snags), NCR (non-conformance), third-party lab test records.
- FR-5.6 HSE: safety observations, toolbox talks, incidents with severity, PPE compliance; contractor safety scorecards.
- FR-5.7 Drawings/GFC document control: revision-wise distribution to contractors, acknowledgment, superseded-drawing blocking on RA bills.
- **In-depth specification:** WBS templates per segment, scheduling mechanics, milestone certification chain, EVM formulas, photo standards, QC stage-gates, HSE, contractor scoring → `11-project-management-deepdive.md`.

### M6. Procurement & Contracts (P1, Phase 3)

- FR-6.1 Vendor master: vendor types (civil MEP finishes PMC), compliance documents (GST cert, PAN, PF/ESIC codes, CLRA licence, ESI) with expiry tracking; blacklisting; vendor rating (quality/schedule/safety).
- FR-6.2 Sourcing: indents from PM schedule → RFQ with BOQ items → comparative statement (L1/L2, techno-commercial) → approval → LOI/Work Order/Purchase Order.
- FR-6.3 Contracts: item-rate/lump-sum/labour-rate contracts, BOQ with measurement method, terms (retention 5–10%, mobilisation advance, price escalation, defects liability period, RA billing cycle).
- FR-6.4 RA (Running Account) bills: contractor bill entry → measurement book (MB) entries with joint measurement → deductions matrix (retention, TDS 194C, GST RCM, advances, material issues, LD) → net payable → payment run. 3-way match: Work Order/BOQ ↔ MB ↔ Bill.
- FR-6.5 Material management: material master (cement/steel/aggregate/finishes), stock at central + site stores, GRN, issue to contractor/work order, min-max replenishment, cement bag-wise tracking, steel heat-number traceability, physical verification & variance.
- FR-6.6 Asset/equipment register (formwork, machinery) with deployment across projects and hire charges.
- FR-6.7 Vendor portal: RFQ response, work order view, bill submission with documents, payment status, compliance doc upload.

### M7. Finance & Accounting (P0–P1)

- FR-7.1 Demand engine: auto-generation of demand notes per payment plan milestone; unit-level ledger; interest on delayed payments per AFT rate (typically 10.25–12% p.a. — configurable, RERA-capped), interest auto-computation monthly.
- FR-7.2 Collections: instrument capture (gateway, NACH/eNACH mandate, RTGS/NEFT, cheque with PDC register, cash), receipting with clearing states, bounced-instrument workflow (charges + demand), T+1 reconciliation via bank statement import (MT940/CSV), gateway auto-recon.
- FR-7.3 Customer ledger & statements: unit-level running account, statement generation (PDF/email/WhatsApp), aging, allocation rules (FIFO oldest demand), TCS 266QE on property purchases ≥₹50L, TDS 194-IA credit for buyers.
- FR-7.4 Escrow compliance (RERA 70% rule): designated account(s) per project; auto-classification of collections into escrow; withdrawal requests tied to certified completion % with Form 3 (engineer) / Form 4 (architect/CA) certificates attached; escrow utilisation dashboard; breach alerts.
- FR-7.5 Project costing: budget (BOQ + soft costs: land, approvals, marketing, finance cost) vs actuals; cost-to-complete; variance reports; cash-flow forecast (demands + schedule vs outflows) at project/entity/consolidated level.
- FR-7.6 AP: supplier invoices (OCR ingest), approvals, payment runs (Razorpay X/bank file formats), advances, retention release, TDS 194C/194J/194Q computation + quarterly returns (26Q) data, GST RCM self-invoices for contractors.
- FR-7.7 GST: works-contract/UTC classification, rate config (1% affordable / 5% standard without ITC / 12% commercial-with-ITC options), RCM, e-invoicing readiness, GSTR-1/3B data packs, per-state registration mapping.
- FR-7.8 GL & trial balance: chart of accounts per entity, auto-vouchers from sub-ledgers (sales, purchases, payments), day books, Ind AS 115 revenue schedules (% completion from PM cost data), WIP schedules, fixed asset register.
- FR-7.9 Lender/banker pack: stock statements (WIP, receivables), utilisation certificates, escrow movement, covenant monitoring, CIBIL-ready customer data extract.
- FR-7.10 Accounting sync: Tally (XML via gateway) and/or Zoho Books; period lock; reconciliation exceptions queue.
- FR-7.11 Refunds: cancellation refunds (SLA-tracked), EOI token refunds, interest computation, payment modes, audit trail.

### M8. RERA & Compliance (P0–P1)

- FR-8.1 RERA registration register: per project — state authority, registration no., validity, committed completion date, sanctioned plan, approvals uploaded, agent registration list; advertisement compliance check (reg. no. present in all external creatives — validation hook in M4).
- FR-8.2 QPR (quarterly progress report) automation: draft from PM progress (photos, % complete), Finance (collections, escrow), Legal (litigation), Sales (bookings, cancellations); state-specific form mapping (MahaRERA/K-RERA/TN-RERA/TS-RERA etc.); review workflow → submission → acknowledgement filing; reminder calendar.
- FR-8.3 Escrow & withdrawal compliance: engineer/architect/CA certificate workflow (Form 3/4) tied to M7.4; complete audit trail for authority inspection.
- FR-8.4 Statutory calendar: master compliance register (RERA QPR, GST, TDS, PF/ESIC/PT, ROC, environmental cond. compliance, labour licences, insurance) with owners, SLA, escalation, evidence attachment, health dashboard.
- FR-8.5 Complaints (RERA & internal): customer complaints with category, TAT, RERA complaint linkage, hearing dates, compliance-status tracking, RCA.
- FR-8.6 Litigation register: cases (customer, contractor, land), next-hearing calendar, counsel, cost tracking, exposure analysis; feeds QPR litigation disclosures.
- FR-8.7 Approvals & licence vault with expiry alerts (fire NOC, lift licences, environmental consents, occupancy).
- FR-8.8 DPDP Act 2023 readiness: consent capture at lead/portal, purpose-bound data use, data-principal rights workflow (access/correction/erasure), grievance officer config, breach-notification runbook, consent ledger exportable.
- **In-depth specification:** statute→feature map, state profiles (MahaRERA/K-RERA/TN-RERA/TG/UP), field-level QPR source mapping, escrow withdrawal step-by-step, Section 18 refunds, agent compliance, ad gates, RERA audit kit → `12-rera-deepdive.md`.

### M9. HR & Payroll (P1, Phase 4)

- FR-9.1 Org & employee master: entities, departments, designations, grades, cost centres (project-linked cost allocation), statutory IDs (PAN/Aadhaar/UAN/ESIC), document vault with expiry (ID proofs, contracts, police verification for site staff).
- FR-9.2 Attendance: office (biometric/app integration), site staff (mobile geo-fenced selfie attendance with shift rules), leave management (accruals, holidays per state), on-duty/travel.
- FR-9.3 Payroll: India payroll engine or partner integration — salary structures, LOP, arrears, PF/ESIC/PT/LWF/TDS auto-computation, Form 16 data, payslip delivery via email/WhatsApp, payroll GL posting to project cost centres.
- FR-9.4 Sales incentive engine: scheme definitions (per unit/booking, achievement slabs, scheme periods, clawback on cancellation), auto-computation from CRM/Sales events, approval → payout with payroll/backup route.
- FR-9.5 Contractor labour management: contractor-wise labour muster (count from site reports), CLRA compliance, wage register, PF/ESIC of contract labour monitoring (principal-employer obligations), labour-vs-schedule productivity metrics.
- FR-9.6 Recruiting lite: requisitions, candidate pipeline, offer letters; onboarding checklist; exit/OF with asset & clearance tracking.

### M10. Customer Experience (P0 portal, Phase 2+)

- FR-10.1 Homebuyer portal (web + WhatsApp-first): KYC'd login (mobile OTP), booking summary, payment schedule with dues, online payment (gateway/UPI/eNACH setup), receipts & statements, executed documents, construction progress (photos, milestones, % complete), snag reporting, service requests with TAT, possession journey (documents checklist, registration slot booking, refund status).
- FR-10.2 Proactive communication: milestone celebrations, demand T-7/T-3/T-0, receipt acknowledgement, possession notices — WhatsApp HSM + email, all consent-tracked.
- FR-10.3 NPS/CSAT at booking, possession, service resolution; complaint sentiment flags to CRM.
- FR-10.4 Community/onboarding content (loan tie-ups, Vastu/floor-plan viewer link-outs).

### M11. Notification Hub (P0, Phase 1)

- FR-11.1 Channel adapters: WhatsApp Cloud API (HSM + interactive), email (SES/Postmark with per-tenant subdomains + DKIM/SPF/DMARC), SMS (DLT-registered templates & headers), push (portal PWA), in-app inbox.
- FR-11.2 Template management: versioned, per-tenant branding, variable schema, Meta template approval status tracking, DLT template IDs, A/B variants (email subject).
- FR-11.3 Journey orchestration: event-triggered (booking.confirmed → journey) + scheduled (demand reminders) + behavioural (visited-not-booked); branching, wait-until, quiet hours, frequency caps, opt-out (DPDP + TRAI DND).
- FR-11.4 Consent & compliance ledger: channel-wise consent per customer, purpose tagging (transactional vs promotional), TRAI scrubbing for promo SMS, suppression list, audit of every message with status webhooks (delivered/read/failed/blocked).
- FR-11.5 Cost governance: WhatsApp conversation-category pricing tracking, per-tenant spend budget & alerts.

### M12. Analytics & AI (P2, Phase 5)

- FR-12.1 Executive cockpit: revenue/collections/sales/cost KPIs with entity/project rollups, forecast vs plan, risk flags, one-tap drill-down to source.
- FR-12.2 Standard dashboards: Sales velocity & funnel; Marketing ROI; Collections & aging; Project EVM & milestones; Procurement spend & vendor performance; RERA/compliance health; HR headcount & labour productivity; Cash-flow waterfall.
- FR-12.3 Data platform: event stream → warehouse (ClickHouse/Postgres-Citus start) → semantic layer (cubes) → BI embed + export; row-level security mirrors RBAC.
- FR-12.4 AI services (Phase 5): lead scoring (M2), next-best-action for sales, collections-priority model (propensity × value), cost-variance anomaly detection, document OCR (KYC, vendor bills), ERP copilot (NL→SQL over governed semantic layer, permission-aware), auto-draft QPR narratives and daily site reports.
- FR-12.5 Scheduled report delivery (email/WhatsApp PDF): board pack, lender pack, weekly sales report — templated.

---

## 4. Cross-cutting business rules (selected, India-specific)

| # | Rule |
|---|---|
| BR-A | **RERA 70% escrow**: 70% of all project receivables parked in designated account(s); withdrawals only against certified % completion (Form 3/4). System enforces classification and alerts on breach. |
| BR-B | **RERA QPR**: quarterly submission per project per state authority; system drafts, tracks, and escalates; delay beyond due date is a compliance incident. |
| BR-C | **RERA disclosures**: inventory status (booked/sold), carpet area, committed dates displayed in portals must mirror system state; ad creatives must carry registration number (validated in M4). |
| BR-D | **Agreement (Section 13)**: AFT on authority-approved format; eSign executed copy vaulted; deviations logged. |
| BR-E | **Refunds (Section 18)**: promoter-default refunds = amount + prescribed interest within SLA; tracked as compliance item. |
| BR-F | **GST**: RCM on contractor/GTA services; rates by segment (1% affordable, 5% non-ITC standard UTC, commercial per classification); e-invoicing threshold; state-wise registration mapping; input credit eligibility flags on expense masters. |
| BR-G | **TDS**: 194C (contractors, incl. 2% individual / 1%… current rates configurable), 194-IA (1% buyer-side on ≥₹50L), 194J, 194H (broker commission), TCS 266QE (buyer ≥₹50L); rates effective-dated; quarterly return data packs. |
| BR-H | **Commission payable only on realised receipts**; clawback on cancellation within scheme window; TDS 194H on payouts. |
| BR-I | **Labour compliance**: contractor PF/ESIC codes verified before work order approval; CLRA licence expiry blocks RA bill release. |
| BR-J | **DPDP 2023**: consent before promotional comms; transactional comms allowed for contract performance; erasure requests honoured with statutory-retention carve-outs (7y audit/finance). |
| BR-K | **Money handling**: no cash acceptance above statutory limits (₹2L Section 269ST); system blocks cash receipts above limit. |
| BR-L | **Numbering**: statutory document series (demand, receipt, AFT, invoice) per entity, gapless, immutable on issue; void with reversal reference only. |

---

## 5. Non-functional requirements (summary — full in 02)

- Availability 99.9% (business hours 99.95% target for booking/portal flows); RPO ≤15 min, RTO ≤4 h.
- Performance: p95 API <300 ms; portal p95 LCP <2.5 s; launch-day burst 500 req/s.
- Scale headroom: 50 tenants, 10k internal users, 500k customer accounts, 1M leads/yr.
- Security: OWASP ASVS L2, ISO 27001-ready controls, per-tenant encryption keys option, VAPT before go-live.
- Compliance data residency: ap-south-1 (Mumbai) primary; DPDP-aligned processing.
- Accessibility WCAG 2.2 AA; i18n EN + 4 Indic languages (HI, MR, KN, TA) for portal + field app.
