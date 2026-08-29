# 12 — Workflow Architecture

Business workflows (deterministic, in the ERP) and AI workflows (event-triggered agent runs) — separate engines, one audit trail. The approval engine (`../../09`) is shared.

## 1. Construction workflow (deterministic core)

```mermaid
flowchart LR
    WBS[WBS/Baseline] --> ACT[Activities scheduled]
    ACT --> DPR[Daily DPR + photos]
    DPR --> PE[Progress entries + EVM]
    PE --> MC{Milestone complete?}
    MC -->|QC gates + certs| CERT[Milestone certified]
    CERT --> DEM[Demand generated<br/>finance]
    CERT --> RERA[Progress → QPR data]
    PE --> DEL{Delay?}
    DEL -->|yes| DL[Delay log + AI recovery draft<br/>L2 → human baseline revision L4]
```

## 2. Procurement workflow (with AI preparation)

```mermaid
flowchart TB
    SCH[Schedule/BOQ demand forecast] --> MIA[Material Intelligence Agent<br/>days-of-cover, wastage]
    MIA -->|L2 draft| PR[Purchase Requisition]
    HUM[Store/PM human need] --> PR
    PR --> RFQ[RFQ to vendors]
    RFQ --> CMP[Comparison + approval 09]
    CMP --> PO[Purchase Order<br/>L4 human approval]
    PO --> GRN[Goods receipt]
    GRN --> STK[Stock update]
    STK --> CON[Consumption → norms]
    CON -.->|events| MIA
```
AI role: predicts shortage, drafts PRs (L2), monitors PO aging (`purchase_order.delayed`), never issues POs.

## 3. Contractor billing workflow (AI verifies, humans approve — critical rule)

```mermaid
flowchart TB
    WO[Work Order + BOQ] --> MEAS[Measurement book entries<br/>joint, signed]
    MEAS --> BILL[RA bill submitted<br/>vendor portal]
    BILL --> BVA[Billing Verification Agent<br/>bill↔MB↔BOQ 3-way, duplicates,<br/>qty/rate anomalies]
    BVA -->|recommendation + evidence| Q[Exception queue / PM]
    Q --> PM[PM approves measurements<br/>Procurement approves commercial]
    PM --> DED[Deductions: retention·TDS·RCM·advance]
    DED --> PRUN[Payment run: maker FM → checker CFO<br/>L4 human, SoD]
    PRUN --> TALLY[Voucher → Tally]
    BVA -.->|never| PRUN
```
**AI must NOT autonomously authorize high-value financial payments** — the Billing Verification Agent stops at a recommendation; the approval/payment chain is entirely human (`10 §2/§5`).

## 4. AI approval workflow

Full sequence + card spec: `09-ai-tool-contracts.md §4`. Summary: agent → policy gate → approval_request with evidence card → human APPROVE/REJECT/MODIFY/REQUEST REVIEW → idempotent execution → immutable audit. One inbox for human and AI-sourced approvals (source-tagged).

## 5. Workflow engineering rules (both engines)

| Rule | Mechanism |
|---|---|
| Idempotency | idempotency keys on all mutations; consumer dedupe |
| Recoverability | outbox, DLQ + replay, compensation steps on multi-step flows |
| State as data | workflows = state machines in `workflow` schema (07 `../../03 §3` engine reused) |
| SLA everywhere | timers + escalations (`../../07 §7`) |
| Human checkpoints | authority matrix is the single source (`../../09 §2`) |
| Audit | workflow transitions + AI decisions in the same `audit_event` stream |
| Versioning | workflow defs + prompts versioned; in-flight instances pin versions |
