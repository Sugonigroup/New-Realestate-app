# 18 — API Architecture

REST-first (OpenAPI 3.1 contract-first, `/v1`), SSE for streams; GraphQL rejected for v1 (client set is small, caching simplicity matters — ADR-AI6). Standards inherited from `../../03 §1` unchanged: JWT+refresh, RLS tenant guard, cursor pagination, typed filters (Zod), RFC-7807 errors, Idempotency-Key on money mutations, ETag/If-Match optimistic locking, rate limits.

## 1. API surface by module

| Module | Representative endpoints |
|---|---|
| Org/Identity | `/v1/auth/{otp,login,mfa,refresh}`, `/v1/users`, `/v1/roles`, `/v1/permissions` |
| Tenancy | `/v1/tenants`, `/v1/entities`, `/v1/projects` |
| Projects/Planning | `/v1/projects/{id}/wbs`, `/activities`, `/baselines`, `/milestones`, `/milestones/{id}/certifications`, `/progress` |
| BOQ | `/v1/projects/{id}/boqs`, `/boqs/{id}/items`, `/boqs/{id}/revisions` |
| Site | `/v1/projects/{id}/dprs`, `/dprs/{id}/photos`, `/site-issues`, `/labour-muster`, `/equipment-usage` |
| Procurement | `/v1/material-requirements`, `/requisitions`, `/rfqs`, `/quotations`, `/comparisons`, `/purchase-orders`, `/goods-receipts` |
| Inventory | `/v1/materials`, `/warehouses`, `/stock`, `/stock-movements`, `/transfers`, `/reorder-levels` |
| Contractors | `/v1/contractors`, `/contracts`, `/work-orders`, `/measurements`, `/ra-bills`, `/ra-bills/{id}/verification`, `/payments` |
| Finance | `/v1/budgets`, `/cost-codes`, `/commitments`, `/payables`, `/payment-runs`, `/cashflow`, `/demands`, `/receipts`, `/escrow` |
| Quality | `/v1/inspections`, `/checklists`, `/ncrs`, `/corrective-actions`, `/quality-scores` |
| Safety | `/v1/safety-inspections`, `/incidents`, `/near-misses`, `/hazards`, `/safety-scores` |
| Documents | `/v1/documents`, `/documents/{id}/versions`, `/esign`, `/knowledge/query` |
| CRM/Sales | `/v1/leads`, `/opportunities`, `/visits`, `/bookings`, `/agreements`, `/payment-schedules` |
| **AI layer** | `POST /v1/ai/ask` (L0, scoped), `GET /v1/ai/insights?scope=`, `GET /v1/ai/actions?status=`, `POST /v1/ai/actions/{id}/approve|reject|modify` (human), `GET /v1/ai/agents` (registry view), `GET /v1/ai/runs/{id}` (trace), `POST /v1/ai/agents/{code}/suspend` (admin kill-switch) |
| Reporting | `/v1/reports/defs`, `/v1/reports/runs`, `/v1/reports/{id}/download` |
| Notifications | `/v1/notifications`, `/v1/consents`, `/v1/journeys` |
| Webhooks out | signed `POST` to tenant endpoints: `booking.confirmed`, `bill.anomaly_detected`, `approval.requested`… |

## 2. AI API specifics

- `POST /v1/ai/ask`: rate-limited (20/h/user), returns `{answer, citations[], scope_note, confidence}` — citations mandatory for KB questions; no tool-writes from this endpoint (L0) except explicit L2/L3 intents that return pending-action references.
- Approval endpoints re-use human approval engine (`../../09 §1`); AI-sourced requests carry `source=ai_agent`, `ai_action_id`.
- All AI endpoints audited; ask-AI queries logged with scope for compliance review.

## 3. Events & webhooks

Outbound webhooks: HMAC-signed, 3 retries, replay tool. Inbound webhooks (lead sources, payment gateways, WhatsApp): signature-verified, deduped (03 §1, 10 §4 legacy docs).

## 4. Versioning & deprecation

URL versioning; additive changes within `/v1`; breaking → `/v2` + 90-day overlap; event schemas versioned in parallel (`11 §3`); OpenAPI diff gate in CI (`../../03 §8`).
