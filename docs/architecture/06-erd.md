# 06 — Entity Relationship Model (Core ERD)

Mermaid ERD of the principal entities across the four hierarchies + AI layer. Attribute lists are abbreviated to identity + key relations; full field-level DDL is generated in Phase 0–3 work orders (`../../phases/`).

```mermaid
erDiagram
    TENANT ||--o{ ORG_ENTITY : "has"
    ORG_ENTITY ||--o{ PROJECT : "owns"
    PROJECT ||--o{ TOWER : ""
    TOWER ||--o{ FLOOR : ""
    FLOOR ||--o{ UNIT : ""

    PROJECT ||--o{ WBS_NODE : ""
    WBS_NODE ||--o{ ACTIVITY : ""
    ACTIVITY ||--o{ MILESTONE : "certifies"
    PROJECT ||--o{ BOQ : "revised"
    BOQ ||--o{ BOQ_ITEM : ""
    ACTIVITY }o--o{ BOQ_ITEM : "executes"

    PROJECT ||--o{ DAILY_PROGRESS_REPORT : ""
    DAILY_PROGRESS_REPORT ||--o{ SITE_PHOTO : ""
    DAILY_PROGRESS_REPORT ||--o{ LABOUR_MUSTER : ""
    ACTIVITY ||--o{ PROGRESS_ENTRY : "actual %"

    PROJECT ||--o{ MATERIAL_REQUIREMENT : ""
    MATERIAL_REQUIREMENT ||--o{ PURCHASE_REQUISITION : ""
    PURCHASE_REQUISITION ||--o{ RFQ : ""
    RFQ ||--o{ VENDOR_QUOTATION : ""
    RFQ ||--o{ PURCHASE_ORDER : "awarded"
    PURCHASE_ORDER ||--o{ GOODS_RECEIPT : ""
    GOODS_RECEIPT }o--|| WAREHOUSE : "into stock"
    MATERIAL ||--o{ STOCK_MOVEMENT : ""

    CONTRACTOR ||--o{ CONTRACT : ""
    CONTRACT ||--o{ WORK_ORDER : ""
    WORK_ORDER }o--o{ BOQ_ITEM : "allocates"
    WORK_ORDER ||--o{ MEASUREMENT_ENTRY : ""
    MEASUREMENT_ENTRY ||--o{ RA_BILL : "billed on"
    RA_BILL ||--o{ CONTRACTOR_PAYMENT : "settles"
    RA_BILL ||--o{ RETENTION : ""
    CONTRACTOR ||--o{ ADVANCE : ""

    PROJECT ||--o{ BUDGET : ""
    BUDGET ||--o{ COST_CODE : ""
    COST_CODE ||--o{ ACTUAL_COST : ""
    PURCHASE_ORDER ||--o{ COMMITMENT : "creates"
    RA_BILL ||--o{ PAYABLE : ""
    UNIT ||--o{ DEMAND : "payment plan"
    DEMAND ||--o{ RECEIPT : ""

    PROJECT ||--o{ INSPECTION : ""
    INSPECTION ||--o{ NCR : "raises"
    NCR ||--o{ CORRECTIVE_ACTION : ""
    PROJECT ||--o{ SAFETY_INSPECTION : ""
    SAFETY_INSPECTION ||--o{ INCIDENT : ""
    INCIDENT ||--o{ CORRECTIVE_ACTION : ""

    PROJECT ||--o{ DOCUMENT : ""
    DOCUMENT ||--o{ DOCUMENT_VERSION : ""
    DOCUMENT_VERSION ||--o{ RAG_CHUNK : "embedded"

    LEAD ||--o{ OPPORTUNITY : ""
    OPPORTUNITY ||--o{ BOOKING : "wins"
    UNIT ||--o| BOOKING : "reserved by"
    BOOKING ||--o{ AGREEMENT : "AFT"
    BOOKING ||--o{ PAYMENT_SCHEDULE : ""

    USER ||--o{ USER_ROLE : ""
    ROLE ||--o{ USER_ROLE : ""

    AGENT_RUN ||--o{ AI_DECISION : "produces"
    AI_DECISION ||--o{ AI_ACTION : "proposes"
    AI_ACTION }o--o| APPROVAL_REQUEST : "needs human (L4)"
    APPROVAL_REQUEST }o--|| USER : "approver"
    AI_ACTION }o--o| AUDIT_EVENT : "logged as"
```

**Isolation notes:** every entity above carries `tenant_id` (RLS); construction entities carry `project_id` scoped by RBAC; `APPROVAL_REQUEST` is the unified human+AI approval table from `../../09 §1` extended with `source = human | ai_agent` and `ai_action_id` — one approval inbox, one audit trail. Financial/statutory rows are never hard-deleted (`05 §4`).
