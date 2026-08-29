# 08 — AI Agent Specifications (All 12)

Per-agent contract: triggers · inputs · deterministic computations · LLM role · outputs · autonomy ceiling · tools · boundaries · success metrics. Shared mechanics (runtime, memory, audit) — `07`. All money/date math is deterministic code; LLMs classify, extract, summarize, recommend — never compute financial arithmetic (principle 6).

| # | Agent | Ceiling | Primary triggers |
|---|---|---|---|
| 1 | Project Manager Agent | L2 | cron 06:00, `project.risk_changed`, `dpr.submitted` |
| 2 | Construction Progress Agent | L2 | `dpr.submitted`, `progress.updated`, cron daily |
| 3 | Schedule Agent | L2 | `activity.delayed`, baseline change, cron weekly |
| 4 | Procurement Agent | L2 (PR draft) | `material.low_stock`, `material.shortage.predicted`, `purchase_order.delayed` |
| 5 | Material Intelligence Agent | L2 | `stock_movement.created` (batch), cron daily |
| 6 | Contractor Agent | L1 | `rabill.approved`, `quality.ncr_created`, `safety.incident_created`, cron weekly |
| 7 | Billing Verification Agent | L1 (recommend) | `bill.submitted` |
| 8 | Cost Control Agent | L1 | `commitment.created`, `actual_cost.posted`, cron daily |
| 9 | Quality Agent | L3 (NCR draft→task) | `inspection.completed`, photo batches |
| 10 | Safety Agent | L3 | `safety.incident_created`, inspection photos |
| 11 | Document Intelligence Agent | L3 (classify/extract) | `document.uploaded` |
| 12 | Management Intelligence Agent | L2 | cron 05:30 daily, weekly Mon, monthly 1st |

---

**1. Project Manager Agent** — Monitors project health; analyzes progress; detects risks; identifies blockers; summarizes status; recommends corrective actions. *Compute:* health = f(SPI, CPI, overdue milestones, open NCR/NC, escrow drift) via `14` KPIs. *LLM:* risk narrative, blocker clustering, corrective-action recommendation. *Outputs:* daily project insight, `project.risk_changed` events, tasks (L3) for owners. *Boundary:* cannot modify schedule or money — recommends only; baseline changes are L5 without approval.

**2. Construction Progress Agent** — Analyzes DPRs; compares planned vs actual; calculates productivity; identifies delayed activities; forecasts completion. *Compute:* planned/actual %, activity slippage, productivity = qty executed ÷ resource-days (11 §4 methods). *LLM:* explains variance from DPR text + photos (vision), detects photo/evidence gaps. *Outputs:* delayed-activity list with evidence, forecast completion date, tasks to PM (L3). *Boundary:* no schedule edits (L5 w/o approval); flags, doesn't close activities.

**3. Schedule Agent** — Schedule analysis; dependency analysis; critical-path monitoring; delay prediction; recovery recommendations. *Compute:* CPM recompute, float, delay propagation (11 §2); delay prediction = historical delay-class regression (deterministic). *LLM:* recovery sequencing narrative, trade-off explanation. *Outputs:* `activity.delayed` enrichment, recovery plan draft (L2 — applied only via human-approved baseline revision, L4).

**4. Procurement Agent** — Predicts material requirements; analyzes inventory; monitors open POs; detects shortages; prepares purchase requests; monitors vendor delivery. *Compute:* requirement = schedule-derived consumption forecast (BOQ × activity plan) − stock − inbound PO; days-of-cover; vendor OTIF. *LLM:* consolidates requirement rationale. *Outputs:* `material.shortage.predicted`, **draft PRs (L2)**, PO follow-up tasks (L3). *Boundary:* PO creation/sending is L4; vendor changes L4.

**5. Material Intelligence Agent** — Consumption analysis; stock forecasting; abnormal consumption detection; wastage detection; reorder recommendations. *Compute:* consumption vs BOQ norm ratios, EWMA forecast, reorder-point alerts, physical-vs-book variance trends. *LLM:* anomaly narrative linking consumption spikes to activities/weather. *Outputs:* wastage alerts → tasks, reorder recommendations, `material.low_stock`. *Boundary:* write-offs/adjustments are L4 (authority matrix `../../09 §2`).

**6. Contractor Agent** — Contractor performance: productivity, quality, safety, delays, cost; contractor risk score. *Compute:* composite score per `../../11 §9` formula + trend. *LLM:* scorecard commentary. *Outputs:* weekly scorecards, `contractor.performance_declined` events, review tasks (L3). *Boundary:* cannot blacklist or alter contracts (L4/L5).

**7. Billing Verification Agent** — Analyzes contractor bills; compares measurements (bill↔MB), compares BOQ, detects duplicate claims, quantity anomalies, rate anomalies; **recommends approval/rejection**. *Compute:* exact 3-way match deltas (bill qty vs MB vs BOQ balance; rate vs WO rate; cumulative-billed vs SOE; duplicate MB-entry hashes). *LLM:* explanation of mismatch, duplicate-claim narrative. *Outputs:* verification report attached to RA bill with verdict-recommendation; anomalies → `bill.anomaly_detected` → exception queue (07 §5 legacy). *Boundary:* **critical rule — AI never approves or authorizes payment**; RA-bill approval and payment remain human L4 per `../../09` (PM/Procurement/CFO chain).

**8. Cost Control Agent** — Budget vs actual; committed cost; forecast cost; variance; cost-overrun prediction; cost-saving recommendations. *Compute:* EAC = AC + (BAC−EV)/CPI; commitment ledger; variance by cost code; threshold breaches. *LLM:* driver analysis narrative. *Outputs:* `budget.threshold_exceeded`, weekly cost digest, saving recommendations. *Boundary:* budget revisions L4; no payment actions.

**9. Quality Agent** — Inspection analysis; defect classification; NCR creation (draft); corrective-action tracking; quality trend analysis. *Compute:* first-pass rates, NCR aging, closure rates by contractor/stage. *LLM:* vision classification of site photos (honeycombing, cracks, alignment), checklist completeness checks. *Outputs:* draft NCRs auto-created (L3, routed for engineer confirmation), trend digest. *Boundary:* NCR becomes official only after engineer confirm; certification gates remain human.

**10. Safety Agent** — Identifies safety risks; analyzes incidents; monitors corrective actions; generates safety reports. *Compute:* incident frequency/severity rates, CAPA aging, checklist compliance %. *LLM:* hazard detection in photos (PPE gaps, edge protection), incident narrative. *Outputs:* `safety.incident_created` enrichment, CAPA tasks (L3), weekly safety report. *Boundary:* incident severity classification confirmed by safety manager for reportable incidents.

**11. Document Intelligence Agent** — OCR; document classification; contract/BOQ/invoice extraction; clause extraction; document comparison; revision tracking. *Compute:* pipeline per `15` (OCR → parsers → schema extraction with confidence). *LLM:* clause extraction/comparison summaries with citations. *Outputs:* classified docs, structured BOQ/invoice JSON, clause alerts (e.g., retention % differs from standard), revision diffs. *Boundary:* extracted values **never post to finance directly** — always land in review queues; citation mandatory.

**12. Management Intelligence Agent** — CEO dashboard; daily executive brief; weekly project review; monthly management report; project risk summary; recommended decisions. *Compute:* assembles `14` KPI snapshots per `13 §2` templates. *LLM:* executive narrative, decision recommendations with evidence. *Outputs:* 05:30 daily brief (email+WhatsApp+dashboard), weekly review pack, monthly management review; all insights carry drill-down links. *Boundary:* read+report only; sends via notification hub with recipient lists approved in settings.

---

### Cross-agent rules
- Shared evidence format: `[{type: 'kpi'|'record'|'document'|'computation', ref, digest, retrieved_at}]` — every recommendation ≥1 evidence item.
- Agents may subscribe to each other's **events** (never call each other's tools): e.g., Progress Agent output feeds PM Agent.
- Duplicate suppression: one project-risk change per day per class unless severity escalates.
- All 12 agents respect the L5 prohibited list (`10 §5`) absolutely.
