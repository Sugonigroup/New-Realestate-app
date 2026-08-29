# 12 — RERA & Statutory Compliance In-Depth

Deep-dive on `01 §M8` + Phase 4: statute→feature mapping, state profiles, field-level QPR automation, escrow withdrawal process, refunds, complaints, and the audit kit. Legal accuracy note: statute references are to the central Act (RERA 2016) and rules; **state rules/authorities vary and are codified as tenant-editable State Profiles** — the compliance consultant validates each per tenant state.

## 1. Statute → feature map (RERA 2016)

| Section | Statutory requirement | BuildOS feature |
|---|---|---|
| 3 / 4 | Project registration before advertising/selling; disclosures | Compliance: RERA card (reg no, validity, approvals register); block-sale-without-reg guard on booking engine |
| 4(2)(l)(D) | 70% of receivables in designated account; withdrawals pro-rata to completion | Finance: escrow classification, utilisation gauge, withdrawal workflow w/ certified-% guard |
| 11(2) | Registration no. in every advertisement | Marketing publish gate (10 #25) + creative compliance check |
| 11(4) | Quarterly updates to authority (QPR) | QPR engine (§3): draft→review→submit→file |
| 12 / 14 | Plan changes need consent + authority approval | Plan-versioning + change register (Projects 3A) with buyer-consent tracker |
| 13 | Agreement for Sale on approved format, timelines | AFT template engine + eSign (Phase 1 WP-1D); format-version control per state |
| 15 | Cannot advertise new phase without registration | Inventory tree phase flags; launch gate |
| 16 | Agent registration for intermediaries | Partner module: agent reg capture, validity, per-state |
| 18 | Refund with interest on default / buyer exit | Refund workflow, interest engine, SLA tracking (§5) |
| 19 | Buyer obligations (timely payments) | Demand engine + dunning; interest on buyer default per AFT |
| 31 / 32 | Complaints to authority; disposition | Complaint module: RERA case linkage, hearing calendar, compliance status |
| 2(k)/(l) | Carpet area definitions (RERA carpet = walls + internal) | Unit master: carpet is legal area; price quoted per RERA carpet; portal display mirror |
| 4(2)(l)(C) | Sanctioned plan & project details disclosure | Disclosure mirror API (BR-C) — portal shows exactly system state |

Penalty discipline: late-filing fees, s.59/61 penalties tracked as compliance incidents with root-cause (feeds exception council 07 §5).

## 2. State profiles (comparative seed — validated by consultant per tenant state)

| Dimension | MahaRERA | K-RERA | TN-RERA | RERA TG (Telangana) | UP-RERA |
|---|---|---|---|---|---|
| QPR cadence/format | Quarterly, prescribed form | Quarterly (stricter progress detail) | Half-yearly + annual | Quarterly | Quarterly |
| Escrow account rules | Designated acct per project; form-based withdrawal | Separate a/c mandate + engineer cert | As per Act + state circulars | State circulars | Strict monitoring, statements |
| AFT registration | Registration of agreement; e-registration integration | Registration required | Registration required | Registration | Registration |
| Max interest on default (prescribed cap pattern) | State schedule (e.g., MCLR+2% style schedule) | State schedule | State schedule | State schedule | State schedule |
| Complaint fee / process | Online portal, fees | Online | Online | Online | Online |
| Agent registration | Per-state, renewal | Required | Required | Required | Required |
| Special | Grading of projects, consent for plan change | Committed-date extension strictness | — | — | Refund-fast-track orders |

System representation: `StateProfile {qpr_schema_ref, escrow_rules, aft_format_ref, interest_schedule, complaint_meta, agent_rules}` — schema-versioned JSON; QPR export validates against profile. Unknown state → profile-creation task before project go-live.

## 3. QPR automation — field-by-field source mapping

| QPR field group | Fields (typical) | Auto-source | Human step |
|---|---|---|---|
| Project status | % completion (physical), floors/slabs done, planned vs actual dates | Projects EVM + schedule snapshot | PD verifies photo-linked % |
| Sales & booking | Units sanctioned, booked this quarter, cumulative, cancellations, area booked (m²) | Sales inventory + booking/cancellation ledgers | None (review) |
| Collections & funds | Amount due, collected, escrow balance, withdrawals, segregated-acct statement ref | Finance demand/receipt/escrow ledgers | Attach bank statement extract |
| Construction progress | Activity-wise status, milestones achieved | WBS snapshot + certified milestones | Consultant cert if demanded |
| Litigation / complaints | Cases filed, status, authority complaints & resolution | Litigation register + complaints module | Counsel note |
| Approvals | New approvals received, expiring | Approvals register | None |
| Agent list | Registered agents active on project | Partner module | None |
| Defects / quality | Structural issue disclosures (rare) | QC/NCR severity filter | Compliance review |
| Attachments | Progress photos, certificates, statements | Evidence store (photo standard §11.6) | Selection |

Flow: cron T-45 opens draft → auto-fill → maker review (diffs highlighted) → checker (09: maker≠submitter) → export bundle per `StateProfile.qpr_schema` → submit on portal → acknowledgement upload → filed state + calendar update; breach = compliance incident.

## 4. Escrow withdrawal process (70% rule, step-by-step)

1. Finance classifies all project receivables into designated account(s); reconciliation job daily vs bank statement (07 queue).
2. Completion % certified: engineer (Form 3) / architect & CA (Form 4) certificates uploaded per withdrawal request.
3. Withdrawal request: amount ≤ (certified % × total project cost) − prior withdrawals (system guard); maker CFO office → checker CFO → MD above threshold (09).
4. Payment executes (payment run); vouchers; evidence chain (cert + statement + approval) vaulted under RERA folder.
5. Escrow dashboard: 70% gauge, available-to-withdraw, drift alerts; breach event → CFO + Compliance + exec cockpit risk (D1/D8).

## 5. Section 18 refunds (builder default / buyer exit)

Trigger matrix: (a) promoter default (delay > committed date ± grace) → full refund + interest auto-proposed, compliance incident auto-created; (b) buyer exit per AFT → forfeiture matrix (BR-3B) then refund; (c) authority direction (complaint order) → order-linked.
Interest: per StateProfile interest schedule (effective-dated), simple monthly posting; SLA: refund execution tracked (state norms typically ≤45–60 d of order/demand); mode: NEFT to verified bank account (penny-drop verified, integration #13); evidence pack: AFT + receipts + interest calc + approval chain.

## 6. Complaints (internal + RERA)

Internal complaints (portal/service desk) → category TATs (07 §2) → if escalated to authority: RERA case record created (complaint no., hearing dates, counsel, relief sought) → status sync → compliance status (complied/pending) with evidence → closure note feeds QPR. Weekly open-complaint report to MD; repeat-category RCA tasks.

## 7. Agents (channel partners under RERA)

Per-state agent registration capture (no., validity) at onboarding; panel per project blocked if agent reg missing/expired for that state (work-order-style compliance gate, BR-I analog); agent register export for QPR attachment.

## 8. Advertisement & disclosure compliance

Publish gate (integration #25): creative must carry project reg no. + state authority name where mandated; inventory/price/date claims validated against disclosure mirror (BR-C diff = block); landing pages & WhatsApp catalog items inherit the same checks.

## 9. RERA audit kit (inspection readiness)

One-click evidence pack per project: registration, approvals, QPR filings + acks, escrow statements + Form 3/4s, AFT samples, complaint dispositions, agent register, ad-compliance log. Retention: 7 years (audit vault, immutable). Quarterly self-audit checklist auto-scored → D8 dashboard.

## 10. DPDP Act 2023 operational map

| DPDP requirement | System control |
|---|---|
| Notice & consent (purpose-specific) | Consent ledger at lead capture, portal signup, WhatsApp opt-in (05 §1) |
| Data-principal rights | DSAR workflows (access/correction/erasure) with statutory-retention carve-outs (Phase 4 WP-4E) |
| Purpose limitation | Field-level access via RBAC; AI masking middleware (05 §9) |
| Security safeguards | 03 §5 controls; breach runbook + Board notification procedure |
| Grievance redressal | Grievance officer config + SLA-tracked grievance tasks |
| Children's data | Age gate on portal features (no profiling <18) |
| Consent managers | Ledger exportable in standard consent format (interoperability-ready) |
