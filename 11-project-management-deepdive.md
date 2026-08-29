# 11 — Project Management In-Depth

Deep-dive on `01 §M5` and Phase 3: WBS templates, scheduling math, the milestone certification chain (the financial heart of the system), progress measurement, QC/HSE micro-processes, and contractor scoring.

## 1. WBS templates (seeded per segment; tenant-editable)

Coding: `PROJECT.TOWER.WBS-LEVEL.ACTIVITY` (e.g., `VRD.T2.03.040`).

**Residential high-rise (extract — full template ~120 activities)**

| Code | WBS / Activity | Duration* | Depends on | Weight % |
|---|---|---|---|---|
| 01 | Mobilisation & site setup | 30 d | — | 1.0 |
| 02 | Excavation & shoring | 45 d | 01 | 3.0 |
| 03 | Raft/foundation (PCC, raft RCC, backfill) | 90 d | 02 | 8.0 |
| 04 | Plinth beam & backfill | 25 d | 03 | 3.0 |  ← **CLP milestone: plinth**
| 05 | Structure RCC per floor (slab cycle 14–21 d) | 14 d × N | 04 | 32.0 | ← **CLP milestones: every 3rd slab**
| 06 | Blockwork & plaster (floor-wise lag) | 10 d × N | 05 (lag 2 slabs) | 12.0 |
| 07 | MEP rough-in (parallel with 06) | — | 05 lag | 8.0 |
| 08 | Waterproofing (terrace, toilets, basement) | 40 d | 05 end | 3.0 |
| 09 | Flooring & dado | 8 d × N | 06 lag | 7.0 |
| 10 | Doors/windows, joinery | — | 06 | 4.0 |
| 11 | Painting & polishing | 6 d × N | 09 | 4.0 |
| 12 | Lifts, DG, fire systems, STP | 90 d | 05 end | 6.0 |
| 13 | External development & landscaping | 60 d | 12 | 4.0 |
| 14 | Testing, commissioning, snag closure | 30 d | 12–13 | 2.0 |
| 15 | **CC → OC → Possession** | 45 d | 14 | 3.0 |

*Indicative for G+18. Plotted/commercial templates have their own trees (plots: roads, drains, electrical, amenities; commercial: cores, façade, fit-outs).

## 2. Scheduling mechanics

- **CPM:** forward/backward pass on FS/SS/FF deps with lags; critical path recompute on any schedule/baseline change (test: known-answer 120-activity network).
- **Baseline discipline:** baseline immutable; changes create baseline revisions with approval (09 matrix: PM ≤7d impact, Project Director ≤30d, MD beyond — auto RERA timeline impact flag if committed dates slip).
- **Look-ahead (3-week):** auto-generated rolling view: activities starting ≤21 d → resource/material/indent readiness check → missing prerequisites auto-create tasks (indent for long-lead materials T-45).
- **Delay log:** delay events (rain, design change, client, authority, contractor) with dates, responsibility, impact-days; feeds EOT (extension of time) register + RERA timeline revision workflow.

## 3. Milestone certification chain (links Projects → Finance → RERA)

```
PM marks activity complete (photos+checklist)
  → Site Engineer evidence pack (§11.5)
  → QC gate: stage checklists closed, NCRs clear (configurable blocker)
  → Structural consultant / Architect certificate (upload, validity check)
  → Project Director certifies → milestone.certified.v1
      ├→ Finance: demand generated per payment plan mapping (Phase 2)
      ├→ RERA: progress % update + QPR data refresh (Phase 4)
      └→ Lender: drawdown milestone check (optional flag)
```
- **Mapping table:** milestone ↔ payment-plan milestone ↔ RERA committed timeline ↔ lender schedule — one-to-many aware (one physical milestone can trigger multiple unit demands).
- **Reversal:** certification reversal requires CFO+PD (09) and reverses demands not yet paid (blocks reversal once receipt exists → refund path instead).

## 4. Progress measurement (choose per project, hybrid allowed)

| Method | Formula | Use |
|---|---|---|
| Weighted milestones | Σ(weight × complete) | Default (table §1) |
| BOQ-quantity | qty executed ÷ qty total per BOQ line × line weight | Civil works with MB data |
| Effort/schedule | actual ÷ planned effort | MEP/finishes |
Physical vs financial reconciliation: physical % (Projects) vs cost-booked % (Finance) variance >3 pts → exception task.

## 5. EVM (nightly compute)

`PV = planned value (baseline)` · `EV = budget × physical%` · `AC = actual cost (Finance)`
`SV=EV−PV` · `CV=EV−AC` · `SPI=EV/PV` (thresholds: <0.95 amber, <0.90 red) · `CPI=EV/AC` (<0.95 amber, <0.90 red) · `EAC=BAC/CPI` · `TCPI=(BAC−EV)/(BAC−AC)`.
EVM tiles feed D5; red projects auto-appear in exec cockpit risks (D1).

## 6. Photo & evidence standard (field PWA enforcement)

- Photos: min 3 per milestone activity; EXIF geo+timestamp captured by app (upload fails without), watermark = project+activity+datetime; face-PII auto-blur option; albums per activity; time-lapse per tower (monthly rollup).
- Daily report mandatory fields: manpower by contractor/trade, equipment on site, work front status (per floor matrix), weather, safety observations, blockers, tomorrow's plan. Submission unlocks tomorrow's task list (soft gate).

## 7. QC stage-gate library (micro-checklists)

- **RCC pour card (18 items):** formwork line/level, cover blocks, reinforcement as per BBS, spacing tolerance, laps/anchorage, electral sleeves, conduits, slump test, cube samples (7/28 d), vibration plan, weather clearance, safety barrier, signoffs (site eng, QC eng, structural). Pour blocked digitally without checklist closure.
- **Others:** blockwork (line/plumb/lintels/chasing), plaster (cure/hack marks/line), waterproofing (pond test 48 h + flood photos), flooring (laid level/hollow check), MEP (pressure test, IR test, drainage slope), façade (pull-out test records), lift (TAC inspection).
- NCR workflow: raise → contain → RCA (5-why template) → corrective action → re-inspect; open NCRs block milestone certification per gate config.

## 8. HSE micro-processes

Daily toolbox talk (topic from library, attendance from muster), weekly safety walk (scored checklist), incident register (near-miss/LTI/fatal with immediate-action + RCA + CAPA), PPE compliance photos, contractor safety score (10% weight in contractor score), statutory: safety officer deployment for >500 workers, cranes/lifts third-party inspection certificates with expiry alerts.

## 9. Contractor performance scoring (quarterly)

`Score = 0.4×Schedule (planned vs actual output) + 0.3×Quality (NCR rate, first-pass QC) + 0.2×HSE (incidents, observations) + 0.1×Compliance (bills accuracy, docs currency)` → A/B/C/D bands; D-band triggers procurement review task; feeds new work order recommendations (Procurement D3D).

## 10. Cross-module contracts

Projects publishes: `milestone.certified.v1`, `progress.updated.v1`, `delay.logged.v1`, `contractor.scored.v1`. Consumes: `rabill.approved.v1` (progress-cost reconcile), `demand.generated.v1` (visibility), `complaint.raised.v1` (construction-origin snags).
