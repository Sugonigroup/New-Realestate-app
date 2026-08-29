# 09 — Human Approval System (Deep-Dive)

Design principle: **automate the process, humanize the judgment.** Everything around a decision (routing, reminders, escalation, audit, follow-through) is system work; the human only decides. Extends `03 §3` (engine mechanics) with the full approval catalogue, authority matrices, escalation design, and approval analytics. Implemented in Phase 0 WP-0E; matrices configured per module in later phases.

---

## 1. Approval object model

```
ApprovalRequest {
  action: "sales.discount.apply" | "finance.paymentrun.release" | …
  payload: <typed, versioned JSON>          // what is being approved
  matrix: resolved at request time → {tier, approverRoles[], value}
  state: draft → pending → (query) → approved | rejected | withdrawn | expired
  sla: {due, escalations[]}
  decisions: [{actor, role, decision, comment, e-sign?, latency}]
  effect: on final approval → system executes payload & emits event
}
```

- **Approve = execute.** Approval isn't a flag; the payload executes in a transaction with the decision record. No gap between "approved" and "done" that someone must remember to click.
- **Query state:** approver can ask a question (goes back to maker with SLA) — real ERPs die without this.
- **Versioned payloads:** if the underlying record changes while pending (unit re-priced), request auto-expires with reason; maker re-raises.

## 2. Master authority matrix (seeded defaults; tenant-configurable)

₹ amounts are defaults for a ₹500 Cr developer; slabs per entity, effective-dated, tier = lowest role that can approve alone.

| Action | Tier 1 | Tier 2 | Tier 3 | Maker-checker | Notes |
|---|---|---|---|---|---|
| Discount on base price | SM ≤5% | CFO ≤8% | MD ≤12% | — | >12% = board note; below RERA-displayed price always Tier 3 + legal flag |
| Price list revision | — | CFO | MD | Yes | Effect-date + RERA mirror check |
| Booking exception (unit swap, hold extension >24h) | SM | Sales Head | MD | — | Hold extension auto-denies at SLA end |
| Cancellation & forfeiture deviation | — | CFO | MD | Yes | Policy-matrix defaults don't need approval |
| Refund release | FM ≤₹5L | CFO ≤₹50L | MD >₹50L | Yes | Section-18 refunds flagged compliance |
| Vendor onboarding | Proc Head | CFO (compliance gate) | — | Yes | BR-I docs mandatory |
| Indent → RFQ | PM | Proc Head >₹25L | — | — | — |
| Work Order / PO | Proc Head ≤₹1Cr | CFO ≤₹5Cr | MD >₹5Cr | Yes | Compliance gate pre-check |
| RA bill approval | PM (measure) | Proc Head (commercial) | CFO >₹2Cr | Yes (measure ≠ commercial ≠ pay) | 3-way match clean = fast lane |
| Payment run release | — | CFO | — | **Yes (maker FM)** | SoD hard rule |
| Escrow withdrawal | — | CFO | MD >₹5Cr | Yes | Form 3/4 attached; certified % guard |
| Demand reversal/write-off | FM | CFO | MD | Yes | Full audit + reason dictionary |
| Inventory write-off (materials) | Stores + PM | Proc Head | CFO >₹5L | Yes | |
| QPR submission | Compl. Exec | Compl. Head | — | **Yes** | Maker ≠ submitter |
| Payroll run | HR Exec | HR Head + CFO | — | Yes (dual) | |
| Incentive payout batch | Sales Head | CFO | — | Yes | Clawback check first |
| Partner panel / commission plan | Sales Head | CFO | MD | Yes | |
| Leave (staff) | Manager | — | — | — | Auto-approve ≤2d if balance & no clash? (tenant toggle) |
| Document delete/vault override | — | never | MD + Auditor notification | Yes | Soft-delete only |

**Matrix semantics:** value resolves tier; within tier, **any one** role suffices unless checker=Yes (sequential two-person). Parallel-AND for AFT legal+finance clearance. Quorum/board actions are Tier 3 + offline note attachment.

## 3. SLA & escalation ladder

| Object class | SLA | Ladder |
|---|---|---|
| Money (refunds, payment runs, escrow) | 24 h | reminder 50% → WhatsApp at 80% (interactive Approve/Escalate/Query buttons) → skip-level at 100% → daily MD digest |
| Commercial (PO, RA bill, discount) | 3 d | reminder → manager nudge → next tier |
| Regulatory (QPR, statutory) | fixed to due date | T-7 compliance head + MD directly |
| HR (leave, queries) | 2 d | reminder → manager |

- **Approval inbox order:** by breach risk = f(SLA remaining × amount × class), not FIFO.
- **Silence is never approval.** Expired requests escalate, never auto-pass — except the tenant-enabled low-risk auto-pass: actions under a threshold with clean system checks auto-approve and **enter a 10% sample audit queue** (Phase 5 optional).

## 4. Delegation & availability

- Time-boxed delegation (dates, scoped to action classes, auto-expiry, audit keeps both actors).
- Out-of-office toggle → requests route to delegate immediately.
- Break-glass: MD may approve from mobile with MFA step-up even when matrix says otherwise — recorded as `bypass` with mandatory reason; weekly bypass report to board/auditor.

## 5. Approving where people actually are

- **Mobile approval cards** (ERP/PWA): context (what/why/amount/history/attachments), one-tap Approve / Reject (reason dictionary) / Query.
- **WhatsApp interactive approvals** for Tier 1/2 money actions ≤ threshold: HSM template with Approve/Reject buttons → webhook → MFA-linked identity → decision logged (secondary factor: only for devices with active session in last 7 days).
- Email approvals: read-only link (view + open app to act) — no decisions over email.
- **Batch approve** for homogeneous queues (e.g., 40 leave requests) with per-item expand.

## 6. Segregation of duties (hard system rules)

| Duty pair | Never same person |
|---|---|
| Payroll run: initiate vs approve | HR Exec vs HR Head/CFO |
| Payment: create vs release | FM vs CFO |
| Vendor master edit vs their PO approval | Procurement |
| QPR: compile vs submit | Compliance exec vs head |
| Demand: create vs reverse/write-off | Finance |
| Commission plan: define vs payout batch | Sales vs CFO |
Enforcement: policy engine checks actor history on the object chain, not role labels; violations are impossible at API level and logged if attempted.

## 7. Approval analytics (management of the approvers)

- Decision latency distribution per approver/tier/action; bottleneck leaderboard (auto in exec cockpit risk list).
- SLA breach heatmap; rework rate (requests returned via query); bypass count; auto-pass sample audit results.
- Weekly digest to MD: "5 approvals aged >3d in Procurement, avg decision 26 h vs 24 h SLA."
- Overhaul loop: matrices reviewed quarterly with data (slabs that are always-Tier-1 get raised; always-Tier-3 get lowered).

## 8. Audit & compliance

- Every decision: actor, device, IP, geo (mobile), timestamp, payload hash, comment, e-sign ref.
- Immutable trail exported as evidence pack per object (used in QPR, lender packs, VAPT, statutory audit).
- Sample-based retrospective audits: monthly 5% random approved-then-executed actions re-verified against policy — findings feed the exception council (07 §5).
