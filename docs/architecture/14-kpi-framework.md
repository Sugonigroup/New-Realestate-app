# 14 — KPI Framework

Single source of KPI definitions; `kpi_snapshots` implements exactly these formulas (deterministic SQL); agents and dashboards may only **consume** them. Conventions: money in ₹ paise; schedule in days (IST); every KPI has owner, cadence, thresholds (amber/red), drill path.

## 1. Construction

| KPI | Formula | Thresholds | Source |
|---|---|---|---|
| Planned % | Σ(weight × planned complete-to-date) | — | baseline |
| Actual % | Σ(weight × certified/recorded complete) | — | progress entries |
| Schedule variance (days) | forecast finish − baseline finish | >7 amber, >30 red | schedule |
| SPI | EV ÷ PV | <0.95 amber, <0.90 red | EVM (11 §5) |
| Productivity | qty executed ÷ resource-days vs BOQ norm | <0.85 amber | DPR/muster |
| Forecast completion | deterministic CPM recompute + delay classes | vs committed date | schedule |

## 2. Cost

| KPI | Formula | Thresholds |
|---|---|---|
| Budget (BAC) | Σ approved budget lines | — |
| Actual (AC) | Σ posted costs (accrual-based) | — |
| Committed | Σ open PO/WO values − billed | — |
| Forecast (EAC) | AC + (BAC−EV)÷CPI | vs BAC |
| Cost variance | EV − AC; EAC−BAC | >3% amber, >7% red |
| CPI | EV ÷ AC | <0.95 amber, <0.90 red |

## 3. Procurement

| KPI | Definition |
|---|---|
| Open POs / value | POs in `open/partial` state |
| Late POs | promised date < today, not received |
| Material shortages | materials with days-of-cover < lead time + safety (agent-computed) |
| Vendor performance | OTIF %, quality acceptance %, bill first-pass % (per vendor) |
| PR→PO cycle time | requisition → PO approved, median |

## 4. Inventory

| KPI | Formula |
|---|---|
| Stock value & cover days | on-hand ÷ avg daily consumption |
| Consumption vs norm | actual ÷ BOQ-theoretical per activity |
| Wastage | (consumed − certified-output norm) ÷ consumed |
| Stock variance | physical count − book, by period |
| Reorder alerts | below reorder level |

## 5. Contractors

| KPI | Definition |
|---|---|
| Productivity score | output vs planned (11 §9 weight 0.4) |
| Quality score | NCR rate, first-pass QC (0.3) |
| Safety score | incidents, observations (0.2) |
| Cost score | bill accuracy, wastage recovery (0.1) |
| Schedule adherence | RA milestones vs plan |
| Composite risk score | A/B/C/D band, trend |

## 6. Quality

Inspections done vs planned · first-pass yield · NCRs raised/closed/open · NCR aging · defect density per 100 activities · closure rate (% ≤ SLA) · repeat-defect rate.

## 7. Safety

Incidents (by severity) & near misses per 10⁵ man-hours · hazard observations closed % · CAPA aging & overdue · toolbox-talk compliance · safety score per contractor & project.

## 8. Commercial (from legacy scope, included in briefs)

Collections vs demand, overdue aging, escrow utilisation vs 70% rule, sales velocity, cancellation rate, DSO (`../../01 §M7`, `../../08`).

## 9. AI-layer KPIs

Agent execution success % · recommendation adoption rate · anomaly precision (verified true-positive ÷ flagged) · approval latency of AI-sourced requests vs human · AI cost per project per month · draft-to-acceptance rate (28 §4). AI KPIs feed `21 §6` ops dashboard.
