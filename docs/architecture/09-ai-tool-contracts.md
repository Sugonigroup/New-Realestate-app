# 09 — AI Tool Contracts

The tool layer is the **only** way agents read or change ERP state. Tools are typed (Zod → OpenAPI), allowlisted per agent (`07 §2`), executed under a scoped service identity, idempotent, and audited. Read tools return projectable views — never raw tables.

## 1. Tool registry conventions

| Property | Rule |
|---|---|
| Schema | Zod input/output schemas, versioned (`tool_name@v1`), exported to OpenAPI |
| Idempotency | every write tool requires `idempotency_key` (agent run id + tool + args digest) |
| Tenant/project guard | args must carry scope; policy engine validates against trigger/user scope |
| Autonomy label | each tool declares its minimum gate: `read`, `L3`, `L4-approval`, `L5-blocked` |
| Execution identity | `ai:<agent_code>@vN`; where user-triggered, scopes = agent ∩ user |
| Audit | every call → `ai_actions` + `audit_event` (`05 §2`) |

## 2. Read tools (all agents, L0)

`read_kpis(scope, kpis[], period)` · `read_record(entity, id)` · `search_records(entity, filters, limit≤50)` · `read_events(scope, types[], since)` · `retrieve_knowledge(query, project_id, top_k≤8)` (permission-filtered RAG, citations enforced) · `read_memory(layer, keys)`.

## 3. Write tools — representative contracts (L3/L4)

```ts
// L3 — low-risk execution
notify_role@v1   { tenant, project_id?, role, template, vars, severity }        // via notification hub
create_task@v1   { tenant, project_id, type, ref, owner_role, due, checklist[] }
update_status@v1 { tenant, entity, id, from_state, to_state, note }             // whitelisted transitions only
generate_report@v1 { tenant, report_def, period, recipients[] }                 // reporting engine
create_draft_inspection@v1 { tenant, project_id, stage, items[], photos[] }     // quality agent

// L4 — require human approval (approval_request with evidence card)
create_purchase_request@v1 { tenant, project_id, material_id, qty, unit,
  required_by, basis: {forecast_ref, stock_ref, open_po_ref}, reason }           // Procurement Agent → PR (not PO)
create_ncr@v1    { tenant, project_id, inspection_id, defect_class, photos[],
  severity, evidence }                                                           // Quality Agent draft → engineer confirm
flag_bill_anomaly@v1 { tenant, ra_bill_id, anomalies: [{kind, expected, actual,
  delta, evidence}], recommendation: 'approve'|'reject'|'query' }                // Billing Verification Agent
propose_baseline_revision@v1 { tenant, project_id, changes[], impact_days, evidence }
propose_budget_revision@v1  { tenant, project_id, cost_code, delta, reason, evidence }
create_demand_correction@v1 { tenant, unit_id, correction, evidence }            // finance review queue

// L5 — NEVER callable by agents (existence in code only; registry rejects)
create_purchase_order · release_payment_run · approve_ra_bill · change_contract_terms ·
delete_statutory_record · modify_approval_matrix · send_customer_promotional · execute_refund
```

## 4. AI approval workflow (L4 path)

```mermaid
sequenceDiagram
    participant Agent
    participant PE as Policy Engine
    participant AE as Approval Engine
    participant H as Human approver
    participant T as Tool Layer
    participant ERP
    Agent->>PE: tool@L4(args, evidence[], confidence)
    PE->>AE: approval_request(source='ai_agent', action, payload, evidence card)
    AE->>H: inbox + WhatsApp card: APPROVE / REJECT / MODIFY / REQUEST REVIEW
    H->>AE: decision (+reason, MFA step-up if financial)
    alt approve
        AE->>T: allow (args possibly modified by human)
        T->>ERP: execute idempotently
    else modify
        AE->>Agent: notify modified args (re-validated against schema)
    else reject/review
        AE->>Agent: outcome logged; no execution
    end
    AE->>ERP: audit_event(approval chain immutable)
```

**Approval card content (UI spec in `22 §4`):** Action · Reason (plain language) · Amount · Confidence % · Impact (financial/schedule/operational) · Supporting evidence links (inventory, schedule, consumption, open POs) · Recommended action · Expiry (requests expire in 72 h → escalate, never auto-approve). Every approval records: requester (agent+run), approver, timestamp, decision, reason, AI recommendation, final action (`05 §2`, `../../09 §1`).

## 5. Validation & abuse controls

- Output schema enforcement: non-conforming LLM tool args → repair-retry → deny (counted as quality signal).
- Argument sanity: cross-field validation (qty ≤ forecast + 10% tolerance unless confidence>0.9 & L4; rates never invented — pulled from masters).
- Rate limits per agent: ≤N tool writes/hour (registry); burst → queue.
- Human-context inheritance: user-triggered ask-AI actions can never exceed the user's own permissions (`16 §4`).
