# 20 — Notification & Escalation Architecture

Channels: ERP inbox, email, WhatsApp (primary for field/external), SMS (OTP/failover), push (PWA), dashboard alerts. Transport mechanics, consent, DLT, template governance — inherited from `../../05 §1–3` and `../../01 §M11` (unchanged). This file adds **AI-origin notifications**, severity model, and escalation rules.

## 1. Severity model

| Sev | Meaning | Channels | Ack required | Escalation |
|---|---|---|---|---|
| S0 Critical | safety incident (fatal/LTI), payment failure on run, escrow breach, RERA filing overdue | push + WhatsApp + SMS + dashboard, immediate | yes, 2 h | skip-level at 2 h, function head at 6 h, MD daily digest |
| S1 High | bill anomaly, shortage predicted ≤7 d, SLA breach on money tasks | push + WhatsApp + dashboard | yes, 8 h | manager at SLA |
| S2 Medium | insights, delays, NCR raised, low stock | dashboard + email | no | daily digest |
| S3 Info | reports ready, FYIs, AI insights | dashboard + email digest | no | — |

## 2. AI-origin notification rules

- Every AI notification carries: source badge "AI · agent name", one-line evidence, deep link to the decision record (`ai_decisions`), and where actionable, inline buttons (Approve/Reject for L4 cards, Snooze/Done for tasks).
- Frequency caps per user/day (default 15 actionable); digesting at night for S2/S3; quiet hours 21:00–08:00 for non-S0.
- Language: user memory preference (EN/HI/MR/KN/TA, `04 §7` legacy).
- **AI never sends promotional/customer-bulk messages** (L5); customer-facing transactional messages remain ERP journey-owned.

## 3. Acknowledgement & escalation engine

`notification_log(id, user, channel, severity, payload_ref, sent_at, delivered_at, ack_at, ack_by)`; unacked S0/S1 auto-escalate per table above by creating tasks (micro-management ladder `../../07 §7`) and re-notifying the next role; WhatsApp interactive ack maps to the same `ack_at` trail; all escalation steps audited.

## 4. Preferences & compliance

Per-user channel/severity preferences (defaults per role); consent ledger governs customer channels (DPDP + TRAI DND scrubbing for promo — though promo is human-initiated only); vendor/partner notifications role-based via portal accounts; every template versioned with approval status (Meta HSM / DLT) before send.
