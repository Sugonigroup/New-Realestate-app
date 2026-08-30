# Gap Analysis: Reference ERP (₹1,000 Cr) vs BuildOS Implementation

Source: `ERP_1000Cr_Complete_MD_Documentation.zip` (38 modules)
Compared against: this repository (BuildOS)

---

## Coverage summary

| # | Reference module | Status | Gap detail |
|---|---|---|---|
| 00 | Master Architecture | ✅ Covered | C4 architecture matches design principles |
| 01 | Organization / Master Data | ✅ Covered | Tenant → Entity → Vertical → Project hierarchy |
| 02 | Users / Roles / IAM | ✅ Covered | RBAC+ABAC, 20 roles, MFA, SoD, delegation |
| 03 | Workflow / Approval Engine | ✅ Covered | Authority matrices, SLA, escalation, maker-checker |
| 04 | Document Management | ✅ Covered | Versioned vault, watermarking, OCR hook |
| 05 | Finance / Accounting | ⚠️ **Partial** | Demands/collections/escrow/Tally sync done. **Missing: GL chart of accounts, journals, AP vendor invoices with 3-way match, AR credit control, intercompany, multi-currency, period close checklist, bank reconciliation persistence** |
| 06 | Tax / GST / Statutory | ✅ Covered | Effective-dated tax tables, GST/TDS/TCS computation, filing calendar |
| 07 | FP&A / Budgeting | ⚠️ **Partial** | EVM exists for projects. **Missing: enterprise budget model, rolling forecast, scenario management, budget-vs-actual service, cash planning** |
| 08 | CRM / Sales | ✅ Covered | Leads, pipeline, visits, bookings, pricing, payment plans |
| 09 | Marketing | ✅ Covered | Campaigns, spend, attribution, ROI |
| 10 | Projects / EPC | ✅ Covered | CPM, EVM, DPRs, milestones → demand engine, BOQ |
| 11 | Procurement | ⚠️ **Partial** | RA bills + material stock done. **Missing: full PR → RFQ → comparison → PO → GRN chain persistence, vendor rating** |
| 12 | Inventory / Warehouse | ⚠️ **Partial** | Material stock w/ days-of-cover done. **Missing: warehouses/bins, stock movements/transfers/issues/returns, stock counts, batch/serial, valuation** |
| 13 | Subcontractor | ✅ Covered | Work orders, RA bills, AI verification, retention, deductions |
| 14 | Contracts / Legal | ❌ **Missing** | No contract lifecycle, clauses, obligations, claims, disputes, renewals |
| 15 | Real Estate | ✅ Covered | Units, pricing, bookings, payment plans, escrow, collections, cancellations |
| 16 | Assets / EAM | ❌ **Missing** | No asset register, depreciation, equipment logs, utilization, disposal |
| 17 | HRMS | ⚠️ **Partial** | Employees, attendance, incentives done. **Missing: recruitment, performance, exit, workforce planning, position management** |
| 18 | Payroll | ✅ Covered | PF/ESIC/PT/TDS engine, dual-control runs, payslips |
| 19 | Quality / QMS | ⚠️ **Partial** | NCR workflow done. **Missing: inspection scheduling, quality plans, checklists per activity type, quality score per project** |
| 20 | HSE | ⚠️ **Partial** | Incident classification done. **Missing: safety inspection scheduling, hazard register, PPE tracking, safety plan per project** |
| 21 | Maintenance / CMMS | ❌ **Missing** | No preventive schedules, work orders, spares, breakdown, MTBF/MTTR |
| 22 | Manufacturing / Industrial | ❌ **Missing** | Not relevant for real-estate developer (only if diversifying) |
| 23 | Customer Service | ❌ **Missing** | No service tickets, warranty, AMC, SLA tracking, CSAT |
| 24 | Compliance / Governance | ✅ Covered | RERA QPR, statutory calendar, DPDP, escrow |
| 25 | Risk Management | ❌ **Missing** | No risk register, KRIs, assessments, mitigation tracking |
| 26 | Internal Audit | ⚠️ **Partial** | Audit trail done. **Missing: audit planning, engagement management, findings, remediation tracking** |
| 27 | BI / MIS | ⚠️ **Partial** | KPI framework done. **Missing: metric definition registry, widget framework, alert engine** |
| 28 | Data Platform | ✅ Covered | KPI snapshots, semantic layer |
| 29 | AI Agent Platform | ✅ Covered | 12 agents, policy engine, gateway, runtime, RAG |
| 30 | Collaboration | ⚠️ **Partial** | Notification hub done. **Missing: team chat integration, meeting notes** |
| 31 | Security | ✅ Covered | OWASP, rate limiting, redaction, encryption, RLS |
| 32 | Reporting Catalog | ✅ Covered | Board pack builder, report definitions |
| 33 | Workflow Catalog | ✅ Covered | Authority matrices mapped |
| 34 | API Integration | ✅ Covered | REST + OpenAPI, webhook signatures |
| 35 | Roadmap | ✅ Aligned | Our 10-phase plan matches |
| 36 | Dependency Matrix | ✅ Aligned | Module deps respected |
| 37 | DB Standards | ✅ Aligned | Conventions match |
| 38 | CEO Control Tower | ⚠️ **Partial** | Exec cockpit done. **Missing: AI attention queue format (impact/evidence/owner/due), working capital dashboard** |

---

## Gap priority classification

### P0 — Financial backbone gaps (blocks ₹1,000 Cr scope)
| Gap | What's needed | Effort est. |
|---|---|---|
| General Ledger | Chart of accounts, journals, journal lines, period close | 80 h |
| AP (vendor invoices) | 3-way match service exists; needs vendor invoice persistence + payment proposals | 40 h |
| AR (customer invoices beyond demands) | Credit control, aging, retention receivables | 40 h |
| Bank reconciliation | Bank statement persistence, matching engine (exists as pure fn), reconciliation screen | 24 h |
| Period close | Closing checklist, subledger recon, period lock | 24 h |

### P1 — Operational modules (blocks full enterprise workflow)
| Gap | What's needed | Effort est. |
|---|---|---|
| Contracts/Legal (14) | Contract lifecycle, clauses, obligations, claims, disputes | 60 h |
| Full procurement chain (11) | PR → RFQ → comparison → PO → GRN persistence + workflow | 60 h |
| Inventory/Warehouse (12) | Warehouses, stock movements, transfers, issues, returns, counts, valuation | 60 h |
| Risk Management (25) | Risk register, KRI tracking, mitigation, assessment | 40 h |
| Customer Service (23) | Tickets, SLA, warranty, AMC, CSAT | 40 h |
| FP&A Budgeting (07) | Budget model service, forecast, scenarios, budget-vs-actual | 60 h |

### P2 — Asset & maintenance (blocks ₹1,000 Cr scope)
| Gap | What's needed | Effort est. |
|---|---|---|
| Assets/EAM (16) | Asset register, depreciation, utilization, disposal | 60 h |
| Maintenance/CMMS (21) | PM schedules, work orders, spares, MTBF/MTTR | 60 h |

### P3 — Governance depth
| Gap | What's needed | Effort est. |
|---|---|---|
| Internal Audit (26) | Audit planning, engagements, findings, remediation | 40 h |
| CEO Control Tower (38) | AI attention queue format, working capital dashboard | 24 h |
| BI metric registry (27) | Metric definitions, widget framework, alert engine | 40 h |
| Quality depth (19) | Inspection scheduling, quality plans per activity | 24 h |
| HSE depth (20) | Inspection scheduling, hazard register, PPE tracking | 24 h |
| HRMS depth (17) | Recruitment, performance, exit, workforce planning | 60 h |

---

## Total remaining effort

| Priority | Hours | Note |
|---|---|---|
| P0 Financial backbone | 208 h | Blocks ₹1,000 Cr financial scope |
| P1 Operational modules | 300 h | Blocks enterprise workflow |
| P2 Assets/Maintenance | 120 h | Blocks asset-intensive projects |
| P3 Governance depth | 188 h | Blocks governance certification |
| **Total** | **816 h ±15%** | |

With the existing 272 tests covering Phases 0–5, and the UI plan covering ~660 h of screens, the total remaining effort is:
- **816 h** backend gaps (above)
- **660 h** UI screens (from ui-screens-plan.md)
- **~1,476 h** total, or **~37 weeks** at 40 h/week with agent assistance

## Recommended build order (per reference roadmap + gap severity)

1. **P0 Financial backbone** (GL, AP/AR, bank recon, period close) — blocks everything financial
2. **P1a Procurement chain + Inventory** — blocks enterprise operations
3. **P1b Contracts/Legal + FP&A** — blocks commercial workflow
4. **P2 Assets/EAM + CMMS** — blocks asset-intensive projects
5. **P1c Risk + Customer Service** — blocks governance scope
6. **P3 Governance depth + UI screens** — parallel track, closes remaining gaps
