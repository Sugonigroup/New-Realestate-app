# 17 — Permission Model (RBAC + AI Action Mapping)

Extends `../../03 §2` (mechanism: permission strings, DataScope, 3-layer enforcement) with the prompt's 16-role model and, critically, **AI action rights per role** — the autonomy ceiling that applies when a role invokes AI.

## 1. Role → module access matrix (C=create, R=read, U=update, A=approve, — = none)

| Role | Org | Projects/Planning | BOQ | Site | Procurement | Inventory | Contractors | Finance | Quality | Safety | Docs | CRM/Sales | AI use |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Super Admin | CRUA | CRUA | CRUA | CRUA | CRUA | CRUA | CRUA | CRUA | CRUA | CRUA | CRUA | CRUA | manage policies, all L0–L4 (approval rights), L5 config |
| CEO | CRUA | R | R | R | R | R | R | RUA+A | R | R | R | RUA | all briefs, L0–L1 anywhere, L4 approvals (tier3), ask-AI global scope |
| Director | CRU | CRUA | CRUA | R | CRUA | CRU | CRUA | R+A | A | A | RUA | RUA | L0–L2 own portfolio, L4 per matrix |
| Project Manager | R | CRUA | CRUA | CRUA | CRU(req) | RU | RUA | R | RUA | RU | CRU | R | L0–L3 own project; L4: PR/PO approve (slab), baseline propose |
| Site Engineer | — | RU | R | CRUA | R(req) | RU(issue) | R | — | RU | RU | CRU | — | L0–L3 own project (DPR tools, photo QA), no approvals |
| Civil Engineer | — | CRU | CRU | CRU | R | R | R | — | CRU | R | CRU | — | as Site Engineer + BOQ drafts |
| Procurement Manager | — | R | R | — | CRUA | CRU | RUA | R(payables) | — | — | CRU | — | L0–L3 sourcing; L4: PO/WO approve (slab) |
| Store Manager | — | R | — | R | R | CRUA | R | — | — | — | RU | — | L0–L3 stock ops; L4: write-off |
| Finance Manager | — | R | R | — | R | R | R | CRUA | — | — | RU | R(demands) | L0–L3 finance ops; L4: payment run maker→no, approver per matrix |
| Accountant | — | R | R | — | R | R | R | CRU | — | — | RU | R | L0–L2; no releases |
| Contractor (portal) | — | R(own WO) | R(own BOQ) | RU(measure) | RU(RFQ/bills) | R(own) | R(own) | R(own status) | R(own NCR) | RU(checklists) | CRU(own) | — | **no AI tools**; portal actions only |
| Quality Manager | — | RU | R | R | — | — | R(score) | — | CRUA | — | CRU | — | L0–L3 QA; L4: NCR closure, certification gates |
| Safety Manager | — | RU | — | R | — | — | R(score) | — | — | CRUA | CRU | — | L0–L3; incident severity confirm |
| Sales Manager | R | R(inventory) | — | — | — | — | — | R | — | — | R | CRUA | L0–L3 sales; L4: discount tier per matrix |
| Sales Executive | — | R(assigned) | — | — | — | — | — | — | — | — | R | CRU(own) | L0–L1 own leads; L3 follow-up drafts |
| Viewer / Auditor | R | R | R | R | R | R | R | R | R | R | R | R | L0 only, read-only, no tool writes |

DataScope narrowing (ALL/ENTITY/PROJECT/OWN) applies on top of every cell (03 §2.1). External roles (customer/vendor/partner) unchanged from `../../03 §2.2`.

## 2. AI action → human approval mapping

| AI capability | Who is asked (authority matrix `../../09 §2`) |
|---|---|
| Draft PR → PO approval | Procurement Head ≤₹1Cr → CFO ≤₹5Cr → MD |
| Bill anomaly recommendation | PM (measure) → Procurement (commercial) → CFO (payment) — AI cannot be any of these |
| Reorder alert → emergency PO | Procurement Head + CFO (urgency tag) |
| NCR draft confirmation | QC Engineer / Quality Manager |
| Baseline revision proposal | Project Director ≤30 d impact → MD beyond |
| Budget revision proposal | CFO → MD |
| Report distribution list change | Department head (never AI) |
| Autonomy-policy change | Super Admin only (L5 — AI not involved at all) |

## 3. Enforcement & tests

- AI service identities appear as principals in the authz matrix; the fuzz suite enumerates agent×tool×scope exactly like role×endpoint (`../../03 §8`, `25 §2`).
- Ask-AI: answers and actions are scoped to the invoking user's DataScope; "insufficient permission" is a first-class answer.
- Delegation covers AI approvals too (out-of-office routes AI-sourced L4 requests, audited, `../../09 §4`).
- Tenant policy may only **tighten** levels (e.g., force L2 drafts to L4); it can never raise autonomy above this document's matrix (`10 §2`).
