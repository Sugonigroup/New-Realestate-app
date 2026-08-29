# 04 — Frontend Design

Per the frontend-developer skill: React 19 + Next.js 15 App Router, RSC/streaming, Tailwind v4 + shadcn/ui, TanStack Query for server state, TypeScript strict. Five deployable apps from one design system in a Turborepo.

---

## 1. App portfolio

| App | Users | Route prefix | Notes |
|---|---|---|---|
| **ERP** | Internal (12 role families) | `erp.brand.in` | The main workspace; heavy tables, boards, workflows |
| **Customer Portal** | Homebuyers | `home.brand.in` | WhatsApp-first companion; PWA; launch-day spike tolerant |
| **Partner & Vendor Portal** | Channel partners, vendors | `partners.brand.in` | Two role families, one app, permission-split |
| **Field PWA** | Site engineers, sales-on-ground | same ERP origin `/m` | Mobile-first, offline-tolerant queue, geo features |
| **Marketing site / lead forms** | Public | `brand.in` | Embeddable lead widget; webhook into CRM |

Monorepo: `apps/*` + `packages/{ui, design-tokens, api-client, permissions, money-utils, forms}`. Shared `api-client` generated from OpenAPI; `permissions` package mirrors backend permission strings — one source of truth (`permissions.yaml`) compiled to both TS and backend config.

## 2. Design system

**Foundations**
- Type: Inter (UI) + Inter Devanagari subset for HI/MR; tabular numerals for money columns.
- Color: neutral zinc base; **primary indigo-600**; semantic tokens (`--success/--warning/--danger/--info`) via CSS variables; tenant theming = token override (brand color, logo, portal domain) resolved at the app shell.
- Space: 4px grid; density modes `comfortable` (portals) / `compact` (ERP tables).
- Dark mode: class-based, token-driven, default light; ERP optional.
- Money/date primitives: `<Money>` (₹, Indian grouping `1,23,45,678`, lakh/cr short form toggle), `<Date>` (IST, `DD MMM YYYY`), `<Duration>`. No ad-hoc formatting.

**Component tiers**
1. **Primitives (shadcn/ui + Radix):** button, input, select, combobox, date-picker (IST-safe), dialog, sheet, popover, tooltip, toast, tabs, accordion.
2. **ERP patterns (packages/ui):**
   - `DataTable` — TanStack Table + virtualization; server-side sort/filter/pagination; column presets; saved views (per-user, shareable); inline-edit mode; column money alignment; sticky headers; CSV/XLSX export via backend job.
   - `Kanban` — pipeline views (CRM, snags, tasks) with optimistic DnD (dnd-kit).
   - `Gantt` — project schedules (milestones, dependencies, critical path, baseline compare). Built on a light custom renderer (no heavy dependency; SVG-based).
   - `ApprovalCard` — workflow task with SLA countdown, history trail, delegate button.
   - `MoneyInput`, `GSTBreakup`, `AuthorityMatrixHint` (shows who approves next slab).
   - `UnitGrid` — floor-plate interactive unit selector (SVG per tower) used in sales + partner portal.
   - `Timeline` / `ActivityFeed` — event-sourced history per entity.
   - `FileVault` — upload with presets, OCR status, version compare, eSign status chip.
   - `StatCard`, `KpiTile`, `Sparkline`, `WaterfallChart`, `FunnelChart` (Recharts).
3. **Templates:** `ModuleShell` (sidebar+header+context bar), `Wizard` (booking, onboarding, RFQ), `SplitView` (list + detail), `CommandPalette` (⌘K global search + actions). **Twelve fully specified dashboards** (wireframes, panels, drill-downs, mobile variants, panel registry): `08-dashboards.md`. Micro-level task/checklist/exception-queue UI patterns: `07-micro-management.md`.

**States discipline:** every data surface implements skeleton→error→empty→loaded; error states carry retry + support link; optimistic updates with rollback toast on mutation failure (TanStack Query `onMutate` pattern).

## 3. Information architecture (ERP)

Global shell: `Tenant & project context bar` (entity → vertical → project switcher, remembered per user) · `Global search (⌘K)` · `Notification center` · `My approvals (badge)` · `Help`.

Sidebar modules (role-filtered):

```
Dashboard (role-aware cockpit)
CRM          Leads · Pipeline · Site Visits · Journeys · Attribution
Sales        Inventory · Pricing · Payment Plans · Bookings · AFT · Cancellations
             Channel Partners · Commissions · Payouts
Marketing    Campaigns · Spend · Creatives · Launch Playbooks
Projects     Schedule · Milestones & Certifications · Progress · QC/Snags · HSE
             Drawings · Approvals Register
Procurement  Vendors · Indents · RFQs · Work Orders/POs · RA Bills · Materials · Stores
Finance      Demands · Collections · Customer Ledgers · Escrow · Costing & Budgets
             AP & Payments · GST/TDS · Bank Recon · Lender Packs · Tally Sync
Compliance   RERA Registrations · QPR · Statutory Calendar · Complaints · Litigation
HR           Employees · Attendance · Payroll · Incentives · Contractor Labour · Recruiting
Customer     Portal Content · Service Requests · Possession Pipeline · NPS
Analytics    Dashboards · Reports · Report Scheduler
Admin        Users & Roles · Workflow Designer · Templates · Numbering · Integrations
             Feature Flags · Audit Log · Consents (DPDP)
My Work      My Approvals · My Tasks · My Leads · Delegation
```

Routing: module-per-route segment (`/sales/bookings/[id]`), route-level code splitting, RSC for shells + server data, client components for interactive grids. Deep-linkable filters in URL state.

## 4. Screen inventory (v1 must-haves)

**CRM:** Lead inbox (omnichannel, dedup flags, AI score column, SLA clock) · Lead detail (timeline, WhatsApp thread, quote/visit history, score breakdown) · Pipeline kanban by project · Visit calendar · Source-quality scorecard.
**Sales:** Inventory explorer (project/tree filter, unit state color map) · Unit detail (price compute preview, plan timeline, holds/booking history) · Booking wizard (KYC OCR → plan → discounts with authority hint → payment → docs) · AFT tracker (eSign status, stamp duty) · Partner leaderboard · Commission ledger + payout run.
**Projects:** Project dashboard (EVM tiles, milestone runway, photo strip) · Gantt with baseline variance · Milestone certification flow (Form 3/4 attach) · Daily site report composer (mobile) · Snag board · Approvals register with expiry chips.
**Procurement:** Indent→RFQ pipeline · Comparison sheet (L1 highlight) · Work order detail (BOQ, terms, SOE) · RA bill entry with auto deductions preview · Material stock ledger + site stores.
**Finance:** Demand engine console (pending certifications → demands preview → bulk generate) · Collections inbox (instrument capture, recon exceptions) · Customer ledger (unit timeline: demand/receipt/interest) · Escrow dashboard (70% rule gauge, withdrawals, certificates) · Cost variance (BOQ vs actual, project cascade) · Payment run (approval, file gen) · GST/TDS workbench (period filing packs).
**Compliance:** RERA project card (reg no, dates, QPR history, disclosure mirror) · QPR draft editor (auto-filled sections + human review diffs) · Statutory calendar (month view, owner, SLA) · Litigation register.
**HR:** Attendance console (site map of geo check-ins, anomalies) · Payroll run (draft→approve→disburse, dual control) · Incentive scheme builder + computation preview · Contractor muster.
**Customer portal:** Home (project progress hero, next due) · Payments (schedule, pay now, eNACH setup) · Documents (executed AFT, receipts) · Progress gallery · Service requests · Possession tracker.
**Partner portal:** Live inventory (per panel rules) · My leads (import + status) · My bookings · Commission dashboard (accrued vs paid).
**Vendor portal:** RFQ inbox (respond with rates+docs) · Work orders · Bill submission wizard · Payment status.

## 5. Key UX flows (agent implementation references)

1. **Lead → Booking (sales exec):** capture → auto-route → WhatsApp ack → visit booked (bot) → visit logged → unit hold from UnitGrid → Booking Wizard → discount triggers approval card → approver approves on mobile → schedule generated → payment link → receipt cleared → AFT eSign journey → welcome pack.
2. **Milestone → Demand → Collection:** PM certifies milestone (photo evidence) → finance preview (plan vs milestone mapping exceptions) → bulk demand generate → dunning journey → customer pays via portal/UPI → auto-recon → ledger + receipt → commission accrual event.
3. **RA bill → payment:** contractor submits on portal → OCR extract → 3-way match exceptions → PM/Procurement approval → deduction matrix preview → payment run (maker) → CFO release (checker) → voucher to Tally → vendor notified with payment advice.
4. **QPR quarter close:** cron opens draft → auto-fills from 5 contexts → compliance reviews diffs → internal maker-checker → submit checklist → acknowledgement filed → calendar updated.

## 6. Performance

- RSC-first; interactive islands only for grids/canvas; `next/dynamic` for Gantt, charts, OCR viewers.
- Route-level budgets: initial JS ≤ 200 KB gz per route; ERP tables virtualized (@tanstack/react-virtual) at >100 rows.
- API: composite endpoints (BFF `/v1/portal/*`, `/v1/screen/*` aggregations) to avoid request waterfalls; TanStack Query cache with tag invalidation on SSE domain events.
- Images: Next/Image + S3 transforms (progress photos progressive JPEG/WebP, thumbnails).
- Core Web Vitals gates in CI (Lighthouse CI): portal LCP <2.5s, INP <200ms, CLS <0.1.

## 7. Accessibility & i18n

- WCAG 2.2 AA: Radix primitives, focus-visible rings, full keyboard operation of tables/boards (arrow-key nav patterns), `aria-*` on Kanban/Gantt, contrast-checked tokens, screen-reader labels on money cells ("twelve lakh fifty thousand rupees" via `Intl`).
- i18n: `next-intl`; locales EN, HI, MR, KN, TA (portal + field app first); ICU messages; RTL not required v1.
- Forms: react-hook-form + Zod (shared schemas with backend via packages), inline validation, field-level error text tied to RFC-7807 field errors.

## 8. Frontend testing

- Vitest + Testing Library for components/hooks (money/date/table interactions).
- Storybook for design-system packages with Chromatic visual regression.
- Playwright E2E: booking wizard, RA bill approval, QPR review, portal payment — run in CI; auth via storage-state fixtures per role.
- Permission-aware rendering tests: snapshot per role for each module shell.
