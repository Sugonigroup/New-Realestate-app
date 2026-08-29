# 08 — Dashboard Designs (12)

Concrete designs: purpose, owner, refresh, layout (ASCII wireframe), panels with source, drill-downs. All dashboards read the semantic layer (05B) so numbers match micro-level metrics (07 §6). Every panel is permission-scoped to the viewer's DataScope. Wireframes define layout & content for implementation agents.

Global conventions: KPI tile = value + Δ vs target/last period + sparkline; money tiles show ₹ with Lakh/Cr short form + toggle; every widget has "⤴ drill" to its source screen; filters persist per user; mobile variants reflow to stacked cards.

---

## D1 — Executive Cockpit (MD/CEO)
Refresh: 15 min · Scope: ALL entities. Purpose: one screen before coffee.

```
┌ Portfolio Health ────────────────────────────────────────────────────────────┐
│ [Collections MTD ₹48.2Cr ▲ +6%] [Sales MTD ₹61.5Cr ▲] [Cash+Bank ₹83.4Cr]    │
│ [Escrow Util 61% ⚠2 proj] [Gross Margin 24.1%] [Net Debt/Equity 0.9x]        │
├───────────────────────────────┬──────────────────────────────────────────────┤
│ Collections vs Demand (12 mo) │ Project Health Board (10–14 tiles)           │
│  ▁▂▄▅▃▆▇▅▆█ waterfall+forecast│ ┌────────┐┌────────┐┌────────┐┌────────┐    │
│                               │ │Verde R │ │Atrium C│ │Plots-2 │ │ …      │    │
├───────────────────────────────┤ │SPI .94⚠│ │SPI 1.02│ │SPI 1.1 │ │        │    │
│ Sales Velocity (units/quin)   │ │Coll 78%│ │Coll 91%│ │Coll 64%│ │        │    │
│  funnel ▇▆▄▃▂ by segment      │ └────────┘└────────┘└────────┘└────────┘    │
├───────────────────────────────┼──────────────────────────────────────────────┤
│ Top Risks (auto 5)            │ Approvals waiting on ME (3) · Compliance 🔴 1 │
└───────────────────────────────┴──────────────────────────────────────────────┘
```
Panels: KPI strip (Finance/Sales), demand-vs-collection waterfall w/ forecast, project health grid (SPI, collections %, RERA status color), auto-risk list (cost variance >7%, escrow drift, launch slippage), my approvals. Drill: tile → project dashboard → source record.

## D2 — CFO Collections & Cash
Refresh: hourly + on receipt events.
```
┌ Controls ─ entity·project·period ────────────────────────────────────────────┐
│ [Demand ₹] [Collected ₹ & %] [Overdue ₹ + aging bar 0-30|30-60|60-90|90+]    │
├──────────────────────────┬──────────────────────┬────────────────────────────┤
│ Collections Funnel       │ Aging Buckets ₹      │ Escrow Panel               │
│ Demand→Due→Collected     │ by project (bars)    │ 70% gauge, withdrawals,    │
│                          │                      │ Form3/4 pending, breach ⚠  │
├──────────────────────────┼──────────────────────┼────────────────────────────┤
│ Inflow Forecast 30d      │ Recon Exceptions (n) │ Refunds & Bounces pipeline │
│ (demands+eNACH schedule) │ → queue drill        │                            │
└──────────────────────────┴──────────────────────┴────────────────────────────┘
```

## D3 — Sales Head Velocity
```
┌ KPIs: Bookings MTD | Cancellation % | Inventory ₹ (soldable) | Avg realisation ┐
├───────────────────────────┬──────────────────────────┬─────────────────────────┤
│ Funnel (lead→visit→book)  │ Unit-state map (floor    │ Team board: per exec    │
│ by source & project       │ plates, color=state)     │ pipeline ₹, conversion  │
├───────────────────────────┼──────────────────────────┼─────────────────────────┤
│ Inventory ageing          │ Launch tracker (EOI→     │ Partner performance     │
│ (>90d hotspots)           │ booking curve)           │ top/bottom, clawbacks   │
└───────────────────────────┴──────────────────────────┴─────────────────────────┘
```
Drill: tile → filtered lead inbox / unit grid.

## D4 — Marketing ROI
```
┌ KPIs: Spend MTD | Leads | CPL | CPV | CPB | CAC ──────────────────────────────┐
├──────────────────────────┬─────────────────────────┬───────────────────────────┤
│ Source scorecard table   │ Spend vs bookings (30d) │ Campaign table (CPL trend,│
│ (quality score, conv %)  │ overlay line            │ status, approvals)        │
├──────────────────────────┼─────────────────────────┴───────────────────────────┤
│ Attribution compare      │ Creative gallery (use-rights expiry flags)          │
│ first/last/linear        │                                                     │
└──────────────────────────┴─────────────────────────────────────────────────────┘
```

## D5 — Project Director Dashboard
```
┌ Project switcher · KPIs: SPI | CPI | % Complete | Milestones next 90d | Safety ┐
├───────────────────────────┬────────────────────────────┬───────────────────────┤
│ Gantt (baseline vs actual,│ EVM S-curves (PV/EV/AC)    │ Milestone runway:     │
│ critical path red)        │ with CPI/SPI thresholds    │ cert status + demand  │
│                           │                            │ linkage chips         │
├───────────────────────────┼────────────────────────────┼───────────────────────┤
│ Progress photos strip     │ Snags/NCR board mini       │ Contractor scorecards │
│ (latest per activity)     │ (overdue red)              │ (Q/S/HSE composite)   │
└───────────────────────────┴────────────────────────────┴───────────────────────┘
```

## D6 — Site Engineer Day View (mobile)
```
┌ 07:30 ✅ Checked-in (geo ✓) · Weather ────────────────────────────────────────┐
│ [Today's Tasks 4]  ▸ Pour card L-8 ▸ GRN cement ▸ MB joint measure ▸ Snag     │
│ [Muster] contractor counts (prefilled, confirm/adjust)                        │
│ [Report 17:30] progress % ▸ photos+ ▸ manpower ▸ blockers ▸ SUBMIT            │
└───────────────────────────────────────────────────────────────────────────────┘
```

## D7 — Procurement Spend
KPIs: Open indents, RFQs aging, committed spend vs budget, 3-way first-pass %; panels: category spend, vendor scorecard table, savings (L1 vs budget), materials stock heat by site, payment pipeline.

## D8 — RERA / Compliance Health
```
┌ Compliance Score 92 ──────────────────────────────────────────────────────────┐
│ QPR board (project × quarter tiles: draft/review/submitted/overdue)           │
│ Statutory calendar (month strip: GST·TDS·PF·RERA·ROC color-coded, owner)      │
│ Escrow & certificates (withdrawals pending Form3/4, expiring approvals T-60)  │
│ Complaints & litigation (open, TAT breach red) · Disclosure mirror drift (0)  │
└───────────────────────────────────────────────────────────────────────────────┘
```

## D9 — HR People Ops
KPIs: headcount vs plan, attendance % (office/site split), payroll status, attrition; panels: site attendance map (geo pins), leave forecast week, incentive accruals, contractor muster trend, expiring statutory docs.

## D10 — CRM Executive "My Day"
```
┌ SLA Queue (12 red) ▸ ranked by breach risk ───────────────────────────────────┐
│ [Calls due] [Visits today w/ route] [Follow-ups] [Promise-to-pay broken]      │
│ Score movers (▲ hot) · Stale >48h flagged · Nudges sent today                 │
└───────────────────────────────────────────────────────────────────────────────┘
```

## D11 — Customer Portal Home
Next due card (₹ + date + Pay Now), construction progress (photos + % + milestone timeline), documents (AFT status chip), receipts, service requests, referral nudge.

## D12 — Partner & Vendor Home
Partner: panel inventory, my leads funnel, my bookings, commission (accrued/cleared/paid) + next payout. Vendor: RFQ deadlines, bills in approval (stage chips), payments expected this week, compliance doc expiries.

## D13 — AI Command Center (management; full spec `docs/architecture/22 §2`)
Agents health strip · Alerts & risks feed (S0/S1) · AI recommendations with evidence chips + confidence · Pending approvals (AI-sourced L4 cards: Approve/Reject/Modify/Review) · Forecasts (shortage, completion, EAC) · Ask-AI (scoped, cited) · AI activity & action history.

## D14 — AI Operations (admin; `docs/architecture/21 §4`)
Agent health grid, model spend vs budgets, queue depths, eval quality trends, policy-denial/injection attempts, kill-switches per agent + global AI pause.

---

### Implementation notes
- Each dashboard = one RSC route; panels are independent cache units (TanStack Query keys per panel + SSE invalidation on domain events).
- Panel registry (`dashboards.yaml`) declares: id, layout slot, metric refs, filters, drill target — so new tenant dashboards are config, not code (Phase 5).
- Print/PDF pack layouts reuse the same panel registry (board pack = D1+D2+D5+D8 sections).
