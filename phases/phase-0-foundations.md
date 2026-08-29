# Phase 0 — Foundations (Weeks 1–4)

**Work order for coding agents.** Deliver the platform spine everything else builds on. Read `../02-architecture-c4.md`, `../03-backend-architecture.md`, `../04-frontend-design.md` for design rationale — this file is self-contained for task execution.

## Goal

A deployed skeleton: monorepo + CI/CD + staging infra + login + tenancy + RBAC + workflow engine + document vault + audit log + notification hub plumbing + ERP shell — provable by the exit demo.

## Work packages (parallelizable)

### WP-0A Monorepo & tooling (agent)
- Turborepo + pnpm: `apps/{erp-web,customer-portal,partner-portal}` placeholders, `packages/{ui,api-client,permissions,money-utils,forms,config}`, `services/core-api`, `services/workers`.
- Strict TS config shared; ESLint+Prettier; commitlint; conventional PRs; `permissions.yaml` → codegen to TS + NestJS guard config.
- `money-utils`: integer-paise `Money` VO, Indian formatting (`1,23,45,678`), lakh/cr short forms, GST/TDS rate-table interfaces (effective-dated).
- Accept: `pnpm i && pnpm dev` boots all apps; `pnpm test` runs green hello-world suites.

### WP-0B Infra & CI/CD (agent + DevOps review)
- Terraform: VPC, RDS Postgres 16 (Multi-AZ), ElastiCache Redis, S3 (KMS), ECS Fargate services, ALB+CloudFront, WAF, Secrets Manager, SES sandbox.
- GitHub Actions: lint→type→unit→build→Testcontainers integration→deploy dev (per-PR preview) → staging on merge.
- Docker multi-stage builds; OpenTelemetry SDK wired; Sentry; Grafana Cloud or Datadog stub; `runbooks/` skeleton.
- Accept: PR preview URL works; staging deploy from main; rollback command documented.

### WP-0C Core API foundation (agent)
- NestJS app skeleton: config module, Zod validation pipe, RFC-7807 errors, OpenAPI generation, Prisma with multi-schema setup, request context (tenant/user/correlation), RLS guard (`SET LOCAL app.tenant_id`), outbox table + relay to Redis Streams, BullMQ wiring, idempotency-key middleware.
- Migrations: `tenants, org_entities, verticals, projects, users, roles, permissions, user_roles, sessions, audit_event, outbox, number_series`.
- Seed script: reference tenant "Shree Developers (₹500Cr demo)" with 2 entities, 3 verticals, 2 projects (residential high-rise, commercial office), 20 units.
- Accept: `GET /v1/health` deep-check green; cross-tenant probe test passes (RLS proof suite).

### WP-0D Identity & RBAC (agent)
- Authn: password + OTP (SMS/email adapters stubbed with console + SES), JWT access/refresh rotation, MFA (TOTP) for finance/admin roles, device sessions, lockouts.
- RBAC engine per `03 §2`: permission strings, role templates (20 seeded), DataScope resolution, `@RequirePermission` guard + `useCan` mirror package, ABAC predicate service, maker-checker flag support.
- Admin screens (ERP): users list/invite, role editor (permission matrix UI), audit viewer.
- Accept: authz matrix fuzz test — every seeded role × protected endpoint returns expected 200/403; role UI edits take effect without redeploy.

### WP-0E Workflow engine (agent)
- Data model: `workflow_defs (json)`, `workflow_instances`, `approval_tasks`, `delegations`; state-machine executor with guards (permission, amount slab), SLA timers (BullMQ delayed), escalation chain, delegation, decision audit.
- APIs: start, act (approve/reject/comment/delegate), my-tasks; SSE topic `workflow.tasks`.
- ERP UI: My Approvals inbox + ApprovalCard component; designer-lite (JSON editor + validation) in Admin.
- Accept: discount-style demo flow (tier matrix) runs end-to-end incl. SLA escalation on a forced 1-min timeout.

### WP-0F Documents & audit (agent)
- Document vault: S3 presigned flows, folders per project taxonomy, versioning, OCR hook stub, watermark-on-download, permission checks, expiry tracking.
- Audit: append-only writes for all mutations (before/after JSON, redaction middleware), viewer + CSV export.
- Accept: upload→version→download-watermarked; tamper test (direct DB UPDATE rejected by grants).

### WP-0G ERP shell & design system (agent)
- packages/ui: tokens, primitives (shadcn base), DataTable, ModuleShell, CommandPalette, StatCard, Money/Date primitives, Toast, Wizard, SplitView.
- ERP app shell: login, context bar (entity→vertical→project switcher), role-filtered sidebar (IA per `04 §3`), notification center stub, ⌘K search (static index), dark mode.
- Accept: Lighthouse CI baseline ≥90 a11y/perf on shell; role-filter test with 3 roles.

### WP-0H Notification hub plumbing (agent)
- Template registry (WhatsApp/email/SMS), journey engine v1 (event-triggered, steps, wait, branch, quiet hours), consent ledger, message_log with status webhooks, provider adapters: WhatsApp Cloud API (sandbox), SES, MSG91 stub. Dunning/journey config UI read-only.
- Accept: test journey `user.invited` fires email (SES sandbox) + WhatsApp sandbox message; opt-out suppresses; statuses recorded.

## Exit demo (PO script)
1. Invite user → OTP login → MFA prompt for finance role.
2. Switch project context; sidebar filters per role; unauthorized API call → 403 logged in audit.
3. Start a mock approval → SLA escalate → delegate → approve → audit trail complete.
4. Upload doc → watermark download → expiry alert appears.
5. Trigger journey → WhatsApp + email received → consent toggle stops sends.

## Done when
All WP acceptance criteria green on staging; RLS probe suite + authz fuzz suite in CI; runbook "add a new bounded context" written (used in Phase 1).

## Effort budget
**920 person-hours** — WP-0A 60 · WP-0B 100 · WP-0C 120 · WP-0D 140 · WP-0E 120 · WP-0F 90 · WP-0G 160 · WP-0H 90 · integration/demo 40. Baseline + methodology: `docs/architecture/31-effort-estimation.md` (±15% phase uncertainty; deviations >20% on a WP trigger phase re-estimation).
