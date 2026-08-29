# 22 — Frontend Architecture

Next.js 15 / React 19 / Tailwind v4 / shadcn/ui / TanStack Query — the design system, performance, and a11y budgets of `../../04` are unchanged and reused. This file defines the **new main navigation** and the **AI Command Center**.

## 1. Main navigation (updated from `../../04 §3`)

```
Dashboard          ← role-aware (D1–D12 per ../../08)
Projects           ← inventory, health, portfolio
Construction       ← site ops: DPRs, progress, labour, equipment, snags
Planning           ← WBS, activities, schedules, baselines, look-ahead
BOQ                ← BOQs, items, revisions, norms
Procurement        ← requirements, RFQs, comparisons, POs, GRNs
Materials          ← inventory, stock, movements, consumption, reorder
Contractors        ← contracts, work orders, measurements, RA bills, payments
Finance            ← budgets, costs, commitments, payables, demands/collections, escrow
Quality            ← inspections, NCRs, CAPA, quality scores
Safety             ← inspections, incidents, hazards, CAPA, safety scores
Documents          ← vault, drawings, contracts, knowledge search
CRM                ← leads, pipeline, bookings, partners (sales context)
Reports            ← generated packs, scheduler, downloads
AI Command Center  ← NEW (below)
Settings           ← org, users/roles, approvals, workflows, integrations,
                     autonomy policy (admin), notifications, audit
```

Sidebar remains role-filtered (RBAC-driven, `../../03 §2`); sales vs construction module visibility follows the domain-separation rule (`04 §2` legacy).

## 2. AI Command Center (D13)

One screen where management sees and steers everything AI does.

```
┌ AI Command Center ────────────────────────── filters: entity·project·agent·period ┐
│ Health strip: [Agents 12/12 live] [Run success 98.2%] [Cost today ₹412] [Denials 0]│
├──────────────────────────────┬─────────────────────────────────────────────────────┤
│ Alerts & Risks (S0/S1 feed)  │ AI Recommendations (L1/L2)                          │
│ from all agents, severity-   │ cards: recommendation · evidence chips · confidence │
│ sorted, deep-linked          │ [Act] → opens approval card or draft                │
├──────────────────────────────┼─────────────────────────────────────────────────────┤
│ Pending Approvals (AI-sourced)│ Forecasts (shortage, completion, EAC — per 08)     │
│ approval cards w/ APPROVE·    │ trend charts, assumptions listed                    │
│ REJECT·MODIFY·REVIEW (09 §4) │                                                     │
├──────────────────────────────┼─────────────────────────────────────────────────────┤
│ Ask AI (scoped NL query →     │ AI Activity timeline (runs, insights, actions,      │
│ cited answer, L0)             │ approvals, executions) + Action History w/ outcomes │
└──────────────────────────────┴─────────────────────────────────────────────────────┘
```

Panels: project health roll-up, alerts, recommendations, pending approvals, risks, forecasts, AI activity, ask-AI, action history — exactly the mandated list. Admin view adds the **AI Operations dashboard (D14)**: agent health grid, model spend vs budgets, queue depths, quality trends, denial/injection attempts, kill-switches (`21 §4`).

## 3. Implementation patterns (reuse `../../04`)

- RSC shells + client islands; panels are independent cache units; SSE invalidation on `ai.*` events.
- Approval cards reuse `ApprovalCard` with a new source badge + evidence chips component (`EvidenceChips`: record/doc/computation links).
- Ask-AI: streaming answers with inline citations opening the document viewer (`15 §5`); "answer is AI-generated" labeling; thumbs feedback wired to `ai_evals`.
- Every AI number rendered via existing `Money/Date` primitives (no model-formatted numbers).
- Permission-aware rendering: AI panels hidden when role has no AI rights (17 §1 matrix).

## 4. New components for agents

`AgentStatusBadge`, `EvidenceChips`, `ConfidenceMeter`, `ForecastCard` (assumptions listed), `AiActivityTimeline`, `ApprovalCardAi` (extends existing), `AskAiPanel` (streaming + citations), `CostBudgetBar` (admin).

## 5. Non-functional (unchanged budgets)

Route JS ≤200 KB gz, LCP <2.5 s portal / <3 s ERP, INP <200 ms, WCAG 2.2 AA, i18n EN+4 Indic (`../../04 §6–7`). Lighthouse CI gates extended with AI panels.
