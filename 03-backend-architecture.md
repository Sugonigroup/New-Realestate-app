# 03 — Backend Architecture

Companion to `02-architecture-c4.md`. Covers API standards, RBAC deep-dive, the workflow engine, event & job design, security, resilience, observability, and testing. Stack: **TypeScript / NestJS / Prisma / PostgreSQL 16 / Redis 7 / BullMQ / S3**, OpenAPI contract-first.

---

## 1. API design standards

- **Contract-first:** every bounded context exposes REST via OpenAPI 3.1 (`/v1/...`); frontend clients generated with `openapi-typescript`; breaking changes require `/v2` + deprecation window (90 days).
- **Auth:** access JWT (15 min, claims: `sub, tenant, scope-set hash, iat`) + rotating refresh cookie (HttpOnly, SameSite=Strict, device-bound). External portals use OTP sessions. Service-to-service: signed internal headers + mTLS later.
- **Multi-tenancy:** `X-Tenant` derived from token — never accepted from client. Request-scoped `app.tenant_id` GUC → Postgres RLS. Prisma middleware blocks cross-tenant `where` clauses and adds tenant to every create.
- **Conventions:** cursor pagination (`?cursor&limit`, opaque base64 of sort keys); filtering via typed query params (validated by Zod → OpenAPI); idempotency-key header required on all money-mutating POSTs (`POST /bookings, /receipts, /payments`); RFC-7807 problem+json errors; `Etag/If-Match` optimistic locking on editable aggregates (booking, PO, budget).
- **Money:** integer paise everywhere; `Money(value: bigint, currency)` VO; tax engine returns line-wise tax postings (GST/TDS/TCS) that persist with the transaction.
- **Rate limits:** Redis sliding-window — 100 req/min per user (ERP), 30/min per session (portals), stricter on OTP endpoints (5/10 min/phone) with lockout + audit.

### Canonical endpoint shape (example: Sales)

```
GET    /v1/projects/{projectId}/units?state=available&tower=&type=      → cursor page
POST   /v1/units/{unitId}/holds                     (Idempotency-Key)   → Hold
POST   /v1/holds/{holdId}/bookings                  (Idempotency-Key)   → Booking (draft)
POST   /v1/bookings/{id}/submit                                          → WorkflowInstance
GET    /v1/bookings/{id}/aft                                            → AFT doc status
POST   /v1/bookings/{id}/cancellations             (Idempotency-Key)   → Cancellation + refund calc
GET    /v1/partners/me/inventory?projectId=                             → partner-scoped inventory
GET    /v1/customers/me/ledger                                          → customer portal ledger
SSE    /v1/stream  (events: notifications, workflow.tasks, dashboard deltas)
```

**Booking flow (orchestration example):** `POST bookings` → validate (unit state, price list, KYC, BR-K cash limits) → create draft + reserve unit (DB row lock on unit) → `booking.submitted` → discount approval workflow if >authority → on approval: snapshot price book, generate payment schedule, emit `booking.confirmed` → consumers: finance (demand schedule), docs (AFT draft), notify (welcome journey), commission (accrual rule check), analytics. Failure at any consumer → compensating retry via outbox; unit un-reserved only via explicit cancellation.

---

## 2. RBAC + ABAC model (detailed)

### 2.1 Model

```
Permission  = "context.resource.action"   e.g. "sales.booking.approve.discount.tier2"
Role        = named set of Permissions (+ deny list)
UserRole    = User + Role + DataScope
DataScope   = { level: ALL | ENTITY | PROJECT | OWN, refs?: uuid[] }
```

- **Roles are templates, permissions are truth.** Tenant admins can clone/edit roles; seeded templates cover the 12 internal personas + 3 external.
- **ABAC layer** handles record-level rules: `own` (only records they created/own — e.g., a sales exec sees own leads), `project-assigned` (site engineer sees assigned project), plus attribute predicates like "discount ≤ my authority tier".
- **Maker-checker:** sensitive actions declare `requiresApproval` with an authority matrix resolved at request time (amount slabs, role ladder). The workflow engine issues approval tasks; the action applies only on final approval.

### 2.2 Seeded role templates

| Role | Scope default | Notable powers |
|---|---|---|
| Super Admin (tenant) | ALL | Tenant config, roles, integrations |
| MD / Promoter | ALL | Approvals tier3, read everything |
| CFO / Finance Head | ALL | Escrow, payment runs, GST/TDS, approvals tier2 |
| Finance Manager / Executive | ENTITY | Demands, receipts, recon, AP entry |
| Project Director | ALL-projects | Schedule, milestones, approvals |
| Project Manager | PROJECT | WBS, milestones, site reports, procurement requests |
| Site Engineer | PROJECT(own) | Progress, material issue, attendance, QC |
| Procurement Head / Executive | ENTITY | RFQ→PO, vendor master, GRN |
| Stores Keeper | PROJECT | GRN, issues, stock |
| Sales Head | ALL | Pricing, discount tier2, partner panel |
| Sales Manager | ENTITY/PROJECT | Team pipeline, holds, discount tier1 |
| Sales Executive | OWN | Leads, visits, booking drafts |
| CRM Executive | ENTITY | Demands, complaints, handover |
| Marketing Manager | ALL | Campaigns, spend |
| Compliance / Legal | ALL | RERA, QPR submit (with maker-checker), litigation |
| HR Head / Executive | ALL/ENTITY | Payroll (dual-control), attendance |
| Auditor | ALL (read-only) | Audit trail, ledgers |
| Customer (portal) | own unit records | Payments, docs, requests |
| Channel Partner (portal) | own leads/bookings | Inventory read, lead import |
| Vendor (portal) | own RFQs/bills | RFQ response, bill submit |

### 2.3 Enforcement — three layers

1. **API guard:** `@RequirePermission("sales.booking.create")` + scope resolver; resolves DataScope → injects `where` filters; ABAC predicates in policy service.
2. **Database:** Postgres RLS on tenant; row-level visibility filters applied in repository layer (e.g., sales exec `lead.ownerId = user.id`).
3. **Frontend:** permission hooks (`useCan("sales.booking.create")`) hide/disable UI — never trusted as enforcement.

**Separation of duties (hard rules):** payroll initiator ≠ approver; payment-run creator ≠ releaser; QPR maker ≠ submitter; vendor master editor cannot approve their POs.

---

## 3. Workflow engine

- **Definition:** JSON state machine: states, transitions (guards: permission/ABAC/slab), SLA per state, escalation chain, parallel-AND branches (e.g., AFT needs legal + finance clearance).
- **Authority matrices** are data: `{action: "discount", slabs: [{max: "5%", approverRole: "sales_manager"}, {max:"8%", approverRole:"cfo"}, {max:"12%", approverRole:"md"}]}` — tenant-configurable.
- **SLA timers** via BullMQ delayed jobs; escalation → next role + notification; overdue tasks surface on approver dashboards and WhatsApp.
- **Delegation:** time-boxed, audited; approver-of-record retained.
- **Audit:** every transition stores actor, decision, comment, attachment, latency vs SLA.
- v1 contexts using it: discount approvals, booking exceptions, PO/RA-bill approvals, payment runs, price revisions, QPR submission, payroll, leave, vendor onboarding.
- **Full approval-system specification** — master authority matrix (18 actions × tiers), SLA/escalation ladders, delegation & break-glass, WhatsApp interactive approvals, segregation-of-duties rules, approval analytics: `09-approval-system.md`. The engine above implements its mechanics; matrices are seeded data.

---

## 4. Events, outbox, and jobs

- **Transactional outbox:** domain writes + `outbox` row in one DB transaction; relay publishes to Redis Streams; consumers idempotent (processed-event table) with DLQ + replay tooling.
- **Event taxonomy** (see 02 §3 golden events). Versioning: `type.vN`; consumers register handlers with schema validation (Zod).
- **Scheduled jobs (BullMQ cron, IST-aware):**
  - `demand-engine` — daily: milestone certifications not yet demanded → generate demands
  - `dunning` — daily T-7/T-3/T-0/T+7 reminders + eNACH retry schedule
  - `bank-recon` — on statement upload + hourly gateway recon
  - `interest-posting` — monthly per unit
  - `commission-accrual` — on receipt.cleared (event) + weekly payout batch
  - `qpr-drafter` — quarterly opening per project/state
  - `scoring` — nightly lead re-score; `analytics-rollup` — hourly marts
  - `compliance-scan` — daily: expiring docs, overdue statutory items, escrow breach check
- **Long tasks** (exports, OCR batches, report PDFs) run as jobs with progress SSE + email/WhatsApp completion notice.

---

## 5. Security architecture

| Layer | Controls |
|---|---|
| Perimeter | CloudFront + WAF (OWASP ruleset, geo rules), ALB TLS1.2+, API GW throttles |
| Identity | OTP+password+MFA(TOTP); device binding; session revocation list in Redis; brute-force lockouts; optional IP allowlist per role |
| Data | PII fields (Aadhaar, PAN, bank) encrypted field-level (KMS data keys, envelope); documents SSE-KMS; per-tenant KMS key option (Phase 5); TLS in transit everywhere |
| Secrets | AWS Secrets Manager; rotation for DB/Redis/3P keys; no secrets in env files in repo |
| App | Zod input validation at edge of every controller; parameterised queries only (Prisma); upload scanning (ClamAV lambda); signed S3 URLs (5-min) + forced-download watermark for sensitive docs |
| Fraud | Booking velocity checks, duplicate-PAN detection across bookings, broker self-booking block rules, gateway webhook signature verification, amount anomaly alerts |
| Audit | Append-only `audit_event` (no UPDATE grants); write-before-commit on every mutation incl. failed authz; exportable evidence packs |
| DPDP | Consent ledger (channel × purpose × timestamp × proof); DSAR endpoints (access/correction/erasure with statutory-retention exceptions); breach runbook |
| SDLC | SAST (Semgrep) + SCA (Trivy/Dependabot) in CI; SBOM; branch protection; prod access via SSO+just-in-time; VAPT before GA |

---

## 6. Resilience

- **Timeouts** on all outbound calls (HTTP: 3s connect/10s total; DB statement 15s); **retries** with jittered exponential backoff, budget-capped (max 3), only on idempotent ops or with idempotency keys; **circuit breakers** (per integration: WhatsApp, PG, eSign, Tally) with half-open probes and fallback queues.
- **Bulkheads:** separate worker pools per job class so OCR storms don't starve demand engine; queue-priority: money ops > notifications > analytics.
- **Graceful degradation:** portal read-only mode flag; notification channel failover (WhatsApp→SMS→email) on provider outage; booking queue (fair FIFO) on launch bursts with real-time queue position.
- **Backups:** PITR 15-min WAL, nightly snapshots, cross-region (Singapore) copy, monthly restore drill.
- **DR:** warm standby in ap-south-1 secondary AZ; RTO 4h runbook; quarterly game day.

---

## 7. Observability

- **Tracing:** OpenTelemetry auto-instrumentation (NestJS, Prisma, BullMQ, HTTP) → trace_id propagated through events to workers → Grafana Tempo/Datadog.
- **Metrics:** RED per endpoint; business metrics as first-class — leads/day, booking conversion, demand ₹ vs collected ₹, escrow utilisation %, queue depths, WhatsApp template health, GST filing status.
- **Logs:** structured JSON with tenant, user, correlationId; PII redaction middleware (Aadhaar/PAN masks) before sink.
- **Alerting:** SLO burn rates; job-failure DLQ > 0; escrow breach; recon mismatch > threshold; notification failure spike; on-call via PagerDuty/Opsgenie.
- **Runbooks per alert** in repo `runbooks/`; error tracking with Sentry (source-mapped frontend + backend).

---

## 8. Testing strategy

| Level | Scope | Tooling | Gate |
|---|---|---|---|
| Unit | Domain logic (tax engine, schedule generator, commission rules, escrow calc, interest) | Vitest | ≥85% line on domain packages; property-based tests for money/date logic (fast-check) |
| Contract | OpenAPI ↔ handlers; event schemas | Zod schema tests + oasdiff | Breaking-change check in CI |
| Integration | Context APIs against real PG (testcontainers) + Redis | Vitest + Testcontainers | All golden flows |
| E2E | Critical journeys: lead→booking→demand→receipt→AFT; RA bill→payment; QPR draft | Playwright (API+UI) | CI nightly + pre-release |
| Money correctness | Golden-file tests: 20 sample units × plans × GST/TDS/forfeiture scenarios | Snapshot suite | Exact-paise match |
| Load | Launch-day simulation: 500 rps read burst + booking queue | k6 | p95 targets met, no unit deadlocks |
| Security | ZAP baseline, authz matrix fuzz (each role × each endpoint) | CI weekly | No criticals |
| RLS proof | Cross-tenant probe suite (every table) | CI | Zero leaks |
