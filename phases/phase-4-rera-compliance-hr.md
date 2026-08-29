# Phase 4 — RERA & Compliance + HR & Payroll (Weeks 21–28)

**Work order.** Depends on Phases 1–3 (sales/finance/projects data feeds QPR; bookings feed incentives). Covers `01 §M8–M9`. Self-contained for execution.

## Goal

QPR auto-drafted from live data with human review; statutory calendar operating; complaints & litigation tracked; HR live with geo-attendance, payroll dry run, sales incentives, contractor muster. Exit demo: generate the quarter's QPR draft for a project in 5 minutes of review time; payroll dry-run posts to project cost centres.

## Work packages

### WP-4A RERA registration & disclosure registry (agent)
- Per-project RERA card: authority (state config), registration no./validity, committed dates, approved AFT format reference, agent registrations, advertisement-compliance hook (M4 later — validation API now), disclosure mirror APIs (portal inventory/price/dates must match system state, BR-C).
- Accept: disclosure API diff test — altering displayed price without approval fails check.

### WP-4B QPR engine (agent)
- Quarterly cron opens draft per project per state; auto-fill sections: progress % + photos (Projects), bookings/cancellations (Sales), collections/escrow (Finance), litigation (Compliance); state schema mapping layer (MahaRERA/K-RERA/TN-RERA/TS-RERA templates as structured JSON + export bundle with attachments).
- Review flow: maker (compliance exec) → checker (compliance head) → submit checklist → acknowledgement upload → filing calendar update; SLA escalation T-30/T-15/T-7.
- Accept: seeded quarter produces draft ≥90% auto-filled; export bundle validates against state schema fixtures; maker-checker enforced.

### WP-4C Statutory calendar & compliance health (agent)
- Master register (RERA QPR, GST, TDS, PF/ESIC/PT/LWF, ROC, EC conditions, licences, insurance) with owner, frequency, due rules (state-aware), evidence attachment, escalation; health dashboard (on-time %, overdue list); escrow-breach + certificate-expiry scanning job (from Phase 2/3 data).
- Accept: month simulation generates correct due list for 3 states; overdue escalates to owner then head.

### WP-4D Complaints & litigation (agent)
- Complaints (internal + RERA-linked): category, TAT, hearing dates, compliance status, RCA; litigation register (customer/contractor/land): next hearing calendar, counsel, cost, exposure; feeds QPR litigation section; customer portal tie-in for service complaints.
- Accept: TAT breach escalates; QPR draft picks open cases automatically.

### WP-4E DPDP consent operations (agent)
- Consent ledger dashboards, DSAR workflows (access/correction/erasure with statutory-retention carve-outs), grievance officer config, breach-runbook page, data-retention policy engine (7y audit/finance, lead data TTL).
- Accept: DSAR access request produces complete data export <7 days SLA; erasure respects carve-outs.

### WP-4F HR core & attendance (agent)
- Employee master (statutory IDs, docs, project cost centres), org tree, leave policies (state holidays), **site geo-attendance** (mobile selfie + geo-fence + shift rules, anomaly flags), office attendance integration stub, on-duty/travel.
- Accept: 500-employee attendance import + 100 site check-ins processed; anomaly report correct.

### WP-4G Payroll & incentives (agent)
- Payroll engine or partner-integration adapter: salary structures, LOP, arrears, PF/ESIC/PT/LWF/TDS computation, payslip delivery (email/WhatsApp), GL posting to project cost centres, dual-control run (draft→approve→disburse), Form-16 data pack.
- Sales incentive engine: scheme builder (per-unit, slabs, scheme periods, clawback), computation from CRM/Sales events, approval → payout route.
- Accept: payroll golden tests (5 structures × statutory rates, exact paise); incentive clawback on cancellation reverses correctly.

### WP-4H Contractor labour (agent)
- Contractor muster (counts from site reports), CLRA compliance monitoring, wage register, principal-employer PF/ESIC oversight flags, labour-vs-schedule productivity metrics.
- Accept: muster aggregates match site reports; non-compliant contractor flagged before RA bill (ties to Phase 3 gate).

## §Contract
Events: `qpr.submitted.v1`, `compliance.breach.v1`, `payroll.processed.v1`, `incentive.accrued.v1` · State-config registry shared with Phase 2 GST config.

## Exit demo (PO script)
Open QPR draft (auto-filled) → review diffs → checker approves → export bundle → calendar updated; statutory month view shows filings; geo check-in on field PWA → payroll dry-run → payslip WhatsApp → incentive statement for a sales exec with clawback line.

## Done when
All WP acceptance green; compliance consultant sign-off on QPR templates + statutory register; payroll parallel-run data pack; PO demo executed.

## Effort budget
**720 person-hours** — WP-4A 60 · WP-4B 140 · WP-4C 80 · WP-4D 60 · WP-4E 40 · WP-4F 120 · WP-4G 160 · WP-4H 60 · integration/demo 60. Baseline: `docs/architecture/31-effort-estimation.md`.
