# Module UI Screens Plan — The Experience Stream

Detailed build plan for every screen in `04-frontend-design.md §3–4` that is specified but not yet built. Current UI state: ERP shell + D1 dashboard placeholder (erp-web), complete customer portal (login/home/payments/consents), design system (`packages/ui`: tokens, MoneyText, StatCard, nav). Everything below builds on those.

---

## 1. The hard prerequisite: missing API controllers

All domain services exist and are tested; several lack HTTP controllers. Each UI phase below includes its controller work (~8–16 h each — thin wrappers over tested services with `@RequirePermission`-style guards).

| Phase | Missing controllers | Effort |
|---|---|---|
| U1 | bookings (hold/submit/confirm/cancel), units list, partners/commissions, AFT advance | 16 h |
| U2 | finance queries (demands, ledger, escrow summary — service methods exist), receipt application | 12 h |
| U3 | projects (activities/CPM result, milestones, certifications, site reports), procurement (WOs, RA bills, stock) | 20 h |
| U4 | compliance (QPR, statutory calendar, litigation), HR (employees, attendance, payroll runs, incentives) | 20 h |
| U5 | admin (users/roles/audit), analytics (KPI snapshot reads) | 12 h |

**Total controller gap ≈ 80 h** — small because every service is already written and tested.

## 2. U0 — Shared foundation (must land first)

| Work item | Detail | Hours |
|---|---|---|
| `DataTable` component | TanStack Table + virtualization; server cursor pagination; column presets; URL-synced filters; sticky header; Money column alignment via MoneyText | 24 |
| Typed API client | `openapi-typescript` from the served OpenAPI + fetch wrapper (JWT attach, refresh-on-401, problem+json parsing) | 16 |
| Auth/role context | React context from JWT claims (roles → `filterNav`); refresh interceptor; logout | 12 |
| Form pattern | react-hook-form + zod resolver wired to the RFC-7807 error shape | 8 |
| Project context switcher | entity → vertical → project picker in the shell header; persists per user | 12 |
| Approval inbox widget | header badge + drawer listing pending `approval_tasks` (API exists) | 8 |
| **Total U0** | | **≈ 80 h** |

## 3. U1 — CRM + Sales screens (revenue path first)

| Screen | Key elements (04 §4) | Data source | Hours |
|---|---|---|---|
| Lead Inbox | table w/ status/score/SLA countdown chips, dedup flag badge, source filter tabs; row → detail | `GET /v1/crm/leads` | 16 |
| Lead Detail | split view: timeline (interactions) + info panel; add-interaction form (type/disposition); SLA banner | interactions API | 16 |
| Pipeline Kanban | dnd stage moves (optimistic), per-project filter | status update endpoint | 12 |
| Site Visits | list + schedule form; no-show flag | site_visits (schema exists) | 8 |
| CSV Import | upload → per-row report (imported/duplicates/rejected) display | import endpoint exists | 8 |
| Inventory Explorer | project/tower/floor tree + unit-state color grid; filters (type/state) | **new: units list endpoint** | 16 |
| Booking Wizard | 4-step: customer+KYC → unit+plan (schedule preview from price-preview) → discount (authority hint) → review+confirm; each step a Wizard route | hold/submit/confirm APIs | 24 |
| Bookings list + detail | schedule snapshot table (seq/label/amount/due), AFT status stepper, discount approval status | bookings API | 12 |
| Cancellation flow | initiator/stage selectors → forfeiture+refund preview (exact paise) → confirm | cancel API | 8 |
| Partners + Commissions | partner table (RERA agent reg chip), ledger entries, payout draft→approve | commissions API | 12 |
| **Total U1** | | | **≈ 140 h** |

## 4. U2 — Finance screens

| Screen | Key elements | Hours |
|---|---|---|
| Demands console | table (demandNo/label/amount/due/status), bulk-generate from certified milestones, dunning step shown | 20 |
| Receipt application | amount + instrument (BR-K cash block enforced client-side too) → allocation preview (FIFO) → submit | 16 |
| Customer ledger | unit timeline (demand/receipt/interest/bounce rows, running balance) | 12 |
| Escrow dashboard (D2 panel) | 70% gauge (parked-required vs withdrawn), max-withdrawable, withdrawal request w/ Form3/4 refs | 16 |
| Tally sync status | control totals, last sync, mismatches | 8 |
| **Total U2** | | **≈ 100 h** (incl. 12 h controllers) |

## 5. U3 — Projects + Procurement screens

| Screen | Key elements | Hours |
|---|---|---|
| Project dashboard (D5) | SPI/CPI/EVM tiles, health tone colors, milestone runway list | 16 |
| Gantt | SVG renderer: bars per activity, deps as arrows, critical path red, float ghost bars; data = CPM result | 32 |
| Milestone certification | evidence checklist w/ blockers list (photos/pour-cards/NCR/Form3/4), certify button gated | 16 |
| Site reports | daily report list + mobile composer (photos, manpower, blockers) | 16 |
| Approvals register | expiry chips (expired red / expiring-soon amber), plan-change impact badge | 8 |
| Procurement screens | WO list + detail (BOQ lines), RA bill list + verification anomalies display (AI flags amber), stock ledger | 24 |
| QC / NCR / snags | NCR board (state columns), snag list w/ verify loop | 16 |
| **Total U3** | | **≈ 140 h** (incl. 20 h controllers) |

## 6. U4 — Compliance + HR + Admin screens

| Screen | Key elements | Hours |
|---|---|---|
| RERA project card | reg no/state/dates, QPR history stepper, disclosure-mirror status | 12 |
| QPR review | auto-filled fields w/ manual-gap list, maker→checker→submit buttons, export bundle download | 16 |
| Statutory calendar | month grid (items colored by owner/status), overdue escalation list | 12 |
| Litigation / complaints | registers w/ TAT chips | 8 |
| HR: employees + attendance | employee table, geo-attendance map pins + anomaly list | 16 |
| HR: payroll run | draft→approve→disburse stepper, per-employee computed rows, dual-control guard | 16 |
| HR: incentives | scheme list, computation preview w/ clawback lines | 8 |
| Admin: users/roles | user invite, role permission-matrix editor (grid of grants), data-scope assignment | 20 |
| Admin: audit + settings | audit event viewer (filters, detail), integration status cards | 8 |
| **Total U4** | | **≈ 120 h** (incl. 20 h controllers) |

## 7. U5 — Portals + AI Command Center

| Screen | Key elements | Hours |
|---|---|---|
| Partner portal build | login, panel inventory (unit grid), my leads (import+credit status), commission dashboard (accrued/cleared/paid) | 32 |
| Customer portal polish | documents tab (AFT + receipts PDFs), progress gallery, possession tracker | 16 |
| AI Command Center (D13) | agent health strip, recommendations feed (evidence chips), pending approvals cards, ask-AI panel (L0), activity timeline | 24 |
| **Total U5** | | **≈ 80 h** (incl. 12 h controllers) |

## 8. Totals & schedule

| Stream | Hours |
|---|---|
| U0 foundation | 80 |
| U1 CRM+Sales | 140 |
| U2 Finance | 100 |
| U3 Projects+Procurement | 140 |
| U4 Compliance+HR+Admin | 120 |
| U5 Portals+AI Center | 80 |
| **Total** | **≈ 660 h** (±15%) |

Elapsed by team shape:
- 2 devs: **15–18 weeks** (U0 → U1 → U2 → U3 → U4/U5 parallel)
- 3 devs (U0 shared then parallel streams): **10–12 weeks**
- Agent-assisted (this repo's work-order pattern): **7–9 weeks** — screens compress well; DataTable/Query/form patterns amortize after U1

## 9. Build order & gates

1. **U0 first** — nothing else starts without DataTable/API-client/auth-context.
2. **U1 CRM+Sales** — the revenue path users touch daily; ship behind a feature flag per screen.
3. **U2 Finance** — unlocks the collections/escrow daily workflow.
4. **U3+U4** parallel (two streams) once U2 ships.
5. **U5 last** — AI Command Center needs the analytics + approvals it displays.

Per-screen acceptance pattern (matches every prior WP): PO-executable demo script, permission-matrix check (each role sees/does only its cells), keyboard nav + contrast pass, Lighthouse ≥ 90, empty/error/loading states present, and every rupee rendered via MoneyText.

## 10. Risks

- **Gantt complexity** (U3): the 32 h estimate holds only for SVG bars + deps; inline editing is explicitly out of scope (schedule edits stay in Planning forms).
- **Kanban drag UX** (U1): optimistic updates need an SSE invalidation stub — placeholder until the events stream lands.
- **Admin matrix editor** (U4): permission grid is dense — use the same DataTable virtualization; do not hand-roll.
