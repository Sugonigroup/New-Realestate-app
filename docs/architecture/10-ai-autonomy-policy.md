# 10 — AI Autonomy Policy & Approval Matrix

The autonomy model is **policy-as-data** (versioned, tenant-reviewable, enforced by the Policy Engine in `07 §6`) — not conventions in agent code. Every tool call passes the gate; the gate is the same for AI and humans except humans act via direct UI.

## 1. Autonomy levels

| Level | Name | Definition | Examples |
|---|---|---|---|
| **L0** | Read only | Analyze data; no side effects | KPI queries, ask-AI answers with citations |
| **L1** | Recommend | Produce recommendations/risks with evidence; no artifacts | bill verdict-recommendation, cost-saving ideas |
| **L2** | Draft | Prepare artifacts **as drafts** for human action | draft PR, draft NCR, recovery plan, draft email/task, draft inspection |
| **L3** | Low-risk execution | Auto-execute pre-approved, reversible, low-value actions | notifications, reminders, report generation, task creation, status flags, reorder alerts |
| **L4** | Human approval required | Execute **only after explicit human approval** | POs, financial approvals, contractor-bill approvals, contract changes, baseline/budget revisions, refunds, high-value transactions |
| **L5** | Prohibited | Never autonomous — humans only, AI not even a party to execution | see §5 |

## 2. Action → level matrix (seeded defaults; per-tenant policy)

| Action | Level | Notes |
|---|---|---|
| Read/analyze any in-scope data | L0 | scope-limited |
| Risk flags, KPI insights, scorecards | L1 | evidence mandatory |
| Draft PR / NCR / task / report / email / follow-up / inspection | L2 | visible in review queues |
| Send reminders & notifications | L3 | quiet hours + caps |
| Generate & distribute routine reports | L3 | recipients from approved lists |
| Create tasks from findings | L3 | owner from routing rules |
| Non-financial status flags (e.g., unit 'attention') | L3 | whitelisted transitions |
| Publish draft insight to dashboards | L3 | marked AI-generated |
| Purchase **Requisition** creation (draft) | L2 | PR ≠ PO |
| Purchase **Order** create/send | **L4** | authority matrix `../../09 §2` |
| RA-bill approval / payment release | **L4** | SoD chain human-only |
| Any financial payment/refund execution | **L4** | maker-checker human |
| Contract/work-order terms change | **L4** | legal review flag |
| Project baseline / budget revision | **L4** | schedule/budget governance |
| Statutory filings (QPR submit) | **L4** | maker-checker per `../../09` |
| Vendor onboarding/blacklist | **L4** | compliance gate |
| Approval-matrix or autonomy-policy change | **L5** | Super Admin humans only |
| Payroll run approve/disburse | **L5** (AI may compute drafts only) | |
| Statutory record deletion / number-series edit | **L5** | |
| Customer data export / promotional send | **L5** without consent proof | DPDP |
| Direct DB writes by any agent | **L5** | structurally impossible |

## 3. Decision routing rules (policy engine pseudocode)

```
verdict =
  if tool in agent.allowlist == false            → DENY (audit)
  if tool.gate == L5                              → DENY (audit)
  if tool.gate == L4                              → APPROVAL_REQUIRED(evidence card)
  if tool.gate == L3 and confidence >= tenant.l3_confidence_min (default 0.85)
     and severity <= tenant.l3_max_severity (default S2) and rate_limits ok
     and args cross-validated                     → EXECUTE
  if tool.gate == L3 and any check fails          → DOWNGRADE to L2 draft + notify
  else                                            → EXECUTE (read/draft tools)
```
Confidence semantics: model self-report is **not sufficient alone** — deterministic validators must agree (e.g., shortage math recomputed by domain code).

## 4. Escalation & expiry

L4 requests: 72 h expiry → escalate up the authority ladder (`../../09 §3`); **silence never approves**. L2 drafts: 14-day TTL → archived with reason. Repeated policy denials of the same agent+tool (≥10/24 h) → agent auto-suspended + incident.

## 5. Prohibited autonomous actions (L5, absolute)

1. Authorize or release any payment/refund (high-value financial actions).
2. Approve contractor bills or change their status beyond flagging.
3. Execute, amend, or terminate contracts/work orders.
4. Change project baselines, budgets, or committed dates.
5. Submit statutory/regulatory filings.
6. Modify permission, approval, or autonomy configurations.
7. Delete or void statutory/financial records.
8. Send bulk/customer-facing promotional communication.
9. Any direct database mutation (no DB credentials exist for agents).
10. Anything involving Aadhaar/PAN raw values in prompts (masked by gateway, `16 §5`).

## 6. Traceability contract (every AI action)

`agent_id → model + prompt_version → input context ref → tools used + arguments → decision → confidence → policy verdict → approval (id, human, reason) → execution result → timestamps → user context` — all persisted (`05 §2`), exportable evidence packs, replayable from pinned versions. **No untraceable AI response is ever acted upon.**
