# BuildOS — Real Estate Developer ERP (SaaS)

End-to-end planning package for **BuildOS — an AI-operated Construction ERP**: a **multi-tenant SaaS platform** for real estate builders & developers, sized for a **₹500 Cr/annum developer** operating across **multiple real estate segments** (residential, commercial, plotted, mixed-use, redevelopment). The ERP is the **system of record** (deterministic, permission-enforced); the **AI operating layer is the system of intelligence + action** — 12 specialized agents continuously monitor operations, detect risks, prepare evidence-backed decisions, generate reports, automate routine work, and execute only human-approved low-risk actions (autonomy levels L0–L5, security enforced outside the model). Full production architecture: [`docs/architecture/`](docs/architecture/ARCHITECTURE-REVIEW.md).

> **Product name used throughout:** **BuildOS** (placeholder — rename freely).

---

## 1. Executive Summary

| Dimension | Decision |
|---|---|
| **Product** | Multi-tenant SaaS ERP covering the full developer value chain: Land → Approvals → Construction → Sales → Collections → Handover → Post-sales |
| **Anchor tenant profile** | ₹500 Cr revenue, 10–14 concurrent projects, 4–6 cities, 250–400 employees, 500+ channel partners, ~1,200–1,500 unit bookings/year, 3–5k active homebuyers |
| **Segments supported** | Residential (affordable/mid/premium/luxury), Commercial (office/retail), Plotted development, Mixed-use, Redevelopment/JV/JD |
| **Architecture** | C4-modelled; modular monolith on event-driven foundations → extractable microservices (see `02-architecture-c4.md`) |
| **Backend** | TypeScript (NestJS) bounded contexts, PostgreSQL 16 + RLS tenant isolation, Redis + BullMQ jobs, S3 object store, OpenAPI contract-first (see `03-backend-architecture.md`) |
| **Frontend** | Next.js 15 / React 19 design system, 5 role-scoped apps (ERP, Customer, Channel Partner, Vendor, Field mobile) (see `04-frontend-design.md`) |
| **Integrations** | WhatsApp Cloud API, Email (SES/Postmark), SMS (DLT), Razorpay + eNACH, Aadhaar eSign, Tally/Zoho Books, lead portals, Meta/Google Ads (see `05-integrations.md`) |
| **Automation thesis** | Every repetitive human touchpoint is a workflow: lead→visit, demand→collection, milestone→QPR, invoice→payment, employee→payroll. Target: 70% of routine operations touchless by Phase 5 |
| **Execution** | 7 phases / ~36 weeks, each phase packaged as self-contained agent work orders in `phases/` |

### The 12 modules

1. **Platform Core** — tenancy, org structure (Entity/SPV → Vertical → Project), RBAC+ABAC, workflow engine, document vault, audit
2. **CRM** — omnichannel lead capture, scoring, routing, site visits, follow-ups, AI qualification
3. **Sales & Inventory** — unit master, price lists, payment plans, offers/holds, bookings, cancellations, channel partners & commissions
4. **Marketing** — campaigns, spend attribution, CPL/CAC, creatives, lead-source analytics
5. **Project Management** — WBS, schedules, milestones, progress (photo/video evidence), site reports, HSE, QC
6. **Procurement & Contracts** — vendors, RFQ→PO, work orders, BOQ, RA bills, material management, 3-way match
7. **Finance** — demand generation, collections, escrow (70% rule), project costing, GST/TDS, lender reporting, Tally sync
8. **RERA & Compliance** — registrations, QPR auto-drafting, escrow withdrawals, statutory calendar, complaints, document register
9. **HR & Payroll** — org/roles, geo-attendance, payroll, sales incentives, contractor labour, statutory (PF/ESIC/PT/LWF)
10. **Customer Experience** — homebuyer portal, payment self-service, construction updates, possession journey
11. **Notification Hub** — WhatsApp/email/SMS/push orchestration with consent & DLT compliance
12. **Analytics & AI** — executive dashboards, forecasting, lead scoring, document AI, ERP copilot

### Document map

| File | Contents |
|---|---|
| [01-product-requirements.md](01-product-requirements.md) | Personas, module-by-module functional requirements, business rules (RERA, GST, commission) |
| [02-architecture-c4.md](02-architecture-c4.md) | C4 Context → Container → Component diagrams, data model, tenancy model, NFRs |
| [03-backend-architecture.md](03-backend-architecture.md) | Service boundaries, API contracts, events, RBAC deep-dive, security, observability, resilience |
| [04-frontend-design.md](04-frontend-design.md) | Design system, information architecture, screen inventory per module, performance & a11y |
| [05-integrations.md](05-integrations.md) | WhatsApp Cloud API, email, SMS, payments, eSign, accounting, portals — contracts & playbooks |
| [06-execution-plan.md](06-execution-plan.md) | 7-phase roadmap, team model, risks, definition of done, release strategy |
| [07-micro-management.md](07-micro-management.md) | **Micro-level management**: task object, role micro-days, checklist library, exception queues, micro-KPIs, escalation ladders |
| [08-dashboards.md](08-dashboards.md) | **12 dashboard designs** with wireframes: executive, CFO, sales, marketing, project, site-mobile, procurement, RERA, HR, CRM, portals |
| [09-approval-system.md](09-approval-system.md) | **Human approval system**: approval object model, master authority matrix (18 actions × 3 tiers), SLA ladders, delegation, WhatsApp approvals, SoD, approval analytics |
| [10-integrations-sales-marketing.md](10-integrations-sales-marketing.md) | **29 sales & marketing integrations**: lead capture (Meta/Google/portals/telephony), KYC/eSign/eNACH, listing syndication, Meta/Google Ads APIs, CAPI, attribution model |
| [11-project-management-deepdive.md](11-project-management-deepdive.md) | **Project management in-depth**: WBS templates per segment, CPM & look-ahead, milestone certification chain, EVM math, QC stage-gates, HSE, contractor scoring |
| [12-rera-deepdive.md](12-rera-deepdive.md) | **RERA in-depth**: statute→feature map, state profiles (MahaRERA/K-RERA/TN-RERA/TG/UP), field-level QPR automation, escrow Form 3/4 process, Section 18 refunds, DPDP map |
| [31-effort-estimation.md](docs/architecture/31-effort-estimation.md) | **Effort baseline** — per-work-package hour budgets, team/scenario translation, agent-compression model |
| [32-multi-agent-execution.md](docs/architecture/32-multi-agent-execution.md) | **Multi-agent development division** — 13-role agent roster, code-ownership map, parallel lanes, week-by-week dispatch schedule, orchestration protocol |
| `phases/phase-0…6.md` | **Agent-executable work orders** — scope, tasks, acceptance criteria per phase |
| [`docs/architecture/`](docs/architecture/01-system-overview.md) | **AI-operated architecture package (31 files)**: current-state analysis, target architecture, domain/DB/ERD, 12 AI agents + tool contracts + autonomy policy (L0–L5), events, workflows, reporting engine, KPI framework, RAG/document intelligence, security (app+AI), permissions incl. AI rights, API, jobs, notifications, observability, frontend + AI Command Center, deployment, DR, testing, production readiness, 9-phase roadmap, AI cost model, risk register, ADRs, and the final architecture review with scorecard |

### How to execute this plan

`06-execution-plan.md` defines the sequence and dependencies. Each file in `phases/` is written as a **standalone work order** that can be handed to a coding agent (or parallel agents) without other context: it contains scope, file-level task breakdown, interfaces to build against, acceptance criteria, and verification steps. The deep-dive docs (07–12) are the micro-level specification the work orders reference: 09 into Phase 0 (approval engine + matrices), 08 into every phase's dashboard packages, 10 into Phases 1/3/5, 11 into Phase 3, 12 into Phase 4, and 07 is the cross-phase operating model (task envelopes, checklists, exception queues) that all work orders must honor.
