# 07 — Micro-Level Management Deep-Dive

How BuildOS manages work at the **record, task, day and person level** — the layer below modules that actually decides whether an ERP gets adopted or abandoned. Supplements `01 §M1–M12` (what) with the micro-operating model (how, at what granularity).

---

## 1. Management altitudes

| Altitude | Question answered | Object | Cadence | Where in system |
|---|---|---|---|---|
| L0 Portfolio | Are we winning? | Entity/vertical aggregates | Monthly board pack | Exec cockpit (08 §D1) |
| L1 Project | Is this project healthy? | Project KPIs, variances | Weekly review | Project dashboard |
| L2 Process | Is this function flowing? | Queues, SLAs, funnels | Daily standup | Function dashboards |
| **L3 Micro** | **Is this one record moving?** | Lead, unit, demand, RA bill, milestone, complaint, employee-day | Realtime / per-event | Inboxes, exception queues, field PWA |

**Design rule:** every L3 object carries a **management envelope**: `owner, sla_due, next_action, checklist, history, escalation_path`. If any of the six is missing, the object isn't done in Phase acceptance.

## 2. Task object (the micro-management atom)

```
Task {
  ref: <link to source record>       // lead, demand, rabill, milestone…
  type: followup | verify | approve | visit | measure | file | resolve
  owner: user (role at assignment time)
  sla_due: timestamp (IST)           // derived from SLA policy per type
  priority: P0..P3                   // P0 = money/regulatory, computed not manual
  checklist: [items]                 // from template library
  escalation: {after: 50% sla, to: next role; after: 100% → skip-level + WhatsApp}
  outcome: {status, disposition, notes, attachments}   // closed-loop, audited
}
```

- **Auto-created tasks:** every event that needs a human creates a task (recon exception, bounced cheque, expiring licence, SLA breach, negative stock, snag overdue, QPR due-in-30). Humans work **My Work**, not menus. **AI agents create tasks through the same tool layer (`create_task@v1`, L3) with source tagging — a human and an AI finding land in the identical inbox with the identical SLA; the AI operating layer is specified in `docs/architecture/07–10`.**
- **Task SLA policies (seeded):** first lead response 15 min; visit report 24 h; demand exception 48 h; recon exception 48 h; complaint first response 4 h / resolution per category (P0 24 h, P1 72 h, P2 7 d); RA bill approval 3 d; invoice booking 2 d; payroll query 48 h.
- **Dispositions are dictionaries** (per task type) — free-text-only closures are rejected; this is what makes micro-analytics possible.

## 3. Role micro-day (designed operating rhythms)

**Site Engineer (field PWA)**
| Time | Micro-flow | System support |
|---|---|---|
| 07:30 | Geo self check-in; labour muster confirm (contractor counts) | Attendance + muster prefill from yesterday |
| 08:00 | Today's tasks: pour card, GRNs pending, measurements scheduled | Checklist-driven; offline queue |
| 09:00–17:00 | Site photos (auto geo/timestamp, min 3 per milestone activity), material issue entries | Photo evidence standard §11.5 |
| 17:30 | Daily site report: 10 fields + photos → submit | Pre-filled from day's entries; 5-minute rule |
| 17:45 | Snags raised today auto-route; QC due list for tomorrow | Auto tasks to QC/contractor |

**CRM / Sales Executive**
| Time | Micro-flow |
|---|---|
| 09:30 | Inbox zero on SLA queue (red first); WhatsApp ack <15 min for new leads |
| 10:00 | Call blocks with dispositions after each call; next-action mandatory before closing a lead |
| 14:00 | Visit follow-ups; promise capture (date+intent recorded, feeds scoring) |
| 18:00 | Today summary auto-posted to team channel; stale >48 h leads flagged to manager |

**Collections Officer**
| 09:30 | Aging triage: T+7 → promise-to-pay WhatsApp; T+30 → call + restructure proposal; T+60 → legal pre-notice task |
| 11:00 | eNACH returns: re-present decision within same day |
| 16:00 | Today's collections vs target micro-tile; tomorrow's debits preview |

**Stores Keeper / Procurement / Finance** follow the same pattern — a fixed daily rhythm + exception queue; details in their phase work orders.

## 4. Checklist library (micro-items, versioned per tenant)

- **Lead qualify (9):** budget, segment, location, timeline, funding (loan pre-approval?), decision maker, competitor contact, site visit blocker, consent (WhatsApp/DND).
- **Booking (14):** PAN/Aadhaar OCR match, co-applicant, funding plan, plan selection, discount authority, TCS 266QE check, nominee, correspondence address, WhatsApp consent, price snapshot, commission credit rule, KYC expiry, payment instrument, AFT signer list.
- **Milestone certification (8):** physical % photo, pour card/BD checklists closed, NCRs clear, structural cert, measurement entries posted, safety incidents reconciled, RERA timeline impact assessed, demand mapping verified.
- **RA bill (11):** WO valid, BOQ item match, MB entries joint-signed, quantity within SOE balance, previous RA reconciled, material recovery, advance recovery, retention calc, TDS/RCM rate, DLP alive, compliance docs (CLRA/PF/ESIC) current.
- **Possession (12):** CC/OC copy, final measurement, demand clearance, snag list zero, handover kit, society/RWA handover note, registration slot, keys/charge handover, NPS ask, warranty docs, insurance transfer, RERA possession letter.
Checklists are **blocking gates** where tagged mandatory (e.g., no certification without photo evidence).

## 5. Exception management (the real control surface)

Auto-detected exceptions become tasks in typed queues with owners and SLAs:
| Queue | Detector | Owner |
|---|---|---|
| Recon exceptions | bank/gateway matcher | Finance exec |
| Demand mapping gaps | plan ↔ milestone mismatch | CRM lead |
| 3-way match mismatches | procurement matcher | Procurement exec |
| Negative/odd stock | stock ledger invariants | Stores keeper |
| Attendance anomalies | geo/shift rules | HR exec |
| Escrow drift | 70% classifier | CFO + Compliance |
| Statutory overdue | calendar scan | Compliance head |
| Lead SLA breaches | response clock | Sales manager |
| Price/disclosure drift | RERA mirror diff | Compliance |
Weekly "exception council" report (auto): count, aging, repeat offenders by queue → L2 review.

## 6. Micro-KPIs (leading indicators, per person)

| Role | Daily/weekly micro-KPI (auto-computed) |
|---|---|
| Sales exec | first-response %, calls/dispositions, visits done, hold→booking conversion, pipeline added ₹ |
| CRM exec | demand exceptions closed, TAT compliance, complaints resolved vs raised, NPS follow-ups |
| Site engineer | report submitted by 18:00 streak, photo evidence completeness, snags closed vs raised |
| Procurement | RFQ turnaround, 3-way-match first-pass %, indent→PO days |
| Finance | recon first-pass %, demand accuracy (reversals), filing punctuality |
| Approver | decision latency vs SLA, backlog age (see 09 §7) |

These roll up: person → team → function → project → entity, same metric definitions (semantic layer), so micro and macro never disagree.

## 7. Escalation micro-ladders (notification rules)

- **Default ladder:** task owner → +50% SLA reminder (app+push) → 100% skip to reporting manager (WhatsApp) → +24 h function head → daily digest to L1 owner.
- **Money objects escalate faster:** receipts bounced, escrow drift, payment run delays → immediate manager + WhatsApp interactive approve/escalate buttons.
- **Regulatory objects** (QPR, statutory) escalate to compliance head + MD at T-7 without intermediate steps.
- All escalations are tasks (never lost emails), auditable, and silenceable only by closure or documented delegation (09 §4).
