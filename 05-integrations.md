# 05 — Integrations Specification

Every integration sits behind an adapter interface in the Core API (`integrations/`), is circuit-broken, idempotent, and logs to `integration_call` with request/response digests (no PII in logs). Sandbox/production split via env; all credentials in AWS Secrets Manager.

---

## 1. WhatsApp (Meta WhatsApp Cloud API) — primary customer channel

**Setup per tenant:** register business → WABA (WhatsApp Business Account) → one or more numbers per tenant brand; display-name approval; webhook subscriptions to `messages` and `template_status_update`. A BSP (Gupshup/Interakt) is an alternative adapter — same internal contract.

**Capabilities used**
- **HSM templates:** utility (demand, receipt, visit reminder, payment ack), marketing (offers, launch announcements), authentication (login OTP). Template variables typed; per-tenant approval status tracked (`PENDING/APPROVED/REJECTED` with Meta reason).
- **Interactive messages:** list/buttom messages for visit slots, CTA buttons (Pay Now → portal payment page), catalogs (inventory share), flows (requirement capture bot).
- **Inbound:** webhook → dedupe (message id) → route to CRM (lead thread) or bot sessions → auto-attachment to opportunity timeline; media (site photos from engineers) → document vault.
- **Status webhooks:** sent/delivered/read/failed per message → `message_log`; failure taxonomy (template not approved, 24h window expired, user opt-out) feeds journey guards.
- **24-hour window rule:** replies inside customer-service window are free-form; outside it only approved templates — journey engine enforces.
- **Pricing governance:** conversation-category cost tracking per tenant with monthly budget alerts; utility-over-marketing preference where legally equivalent.
- **Opt-out:** STOP keyword handler, per-purpose consent ledger update, suppression enforcement pre-send.

**Internal contract:** `NotificationPort.send({channel: whatsapp, template, to, vars, correlationId, journeyStep?})`; provider adapter implements port; all sends through journey engine (never direct calls from feature code).

## 2. Email (AWS SES primary, Postmark alternative adapter)

- **Per-tenant sending domain:** `mail.<brand>.in` subdomain; automated DKIM CNAMEs, SPF include, DMARC p=rua; warmup schedule (SES v2 dedicated IP pool optional at scale); bounce/complaint webhooks → suppression list.
- **Templates:** MJML source → responsive HTML; same variable schema as WhatsApp templates; per-tenant branding; inline CSS pipeline; plain-text part generated.
- **Transactional classes:** demand letters (PDF attachment), statements, receipts, AFT for review, payment advices, payroll mails, portal OTP (fallback).
- **Tracking:** opens/clicks (pixel + rewrite) with consent-aware gating; feeds CRM engagement scoring.
- **Deliverability SLO:** >98% inbox for transactional; weekly postmaster review; dunning sequence for hard bounces.

## 3. SMS (DLT-compliant)

- **Provider:** MSG91/Pinpoint adapter (DLT registered headers + templates mandatory in India). Use cases: OTP, payment failure alerts, critical reminders when WhatsApp undelivered (failover chain WhatsApp→SMS→email).
- Promo SMS only with consent + DND scrubbing (TRAI preference scrubbing via provider); transactional route for everything else.

## 4. Payments (Razorpay suite; adapter allows PayU/Cashfree)

- **Payment Gateway:** UPI/cards/netbanking; hosted payment page + payment links (deep-linked from WhatsApp "Pay Now"); webhook `payment.captured` → idempotent receipt creation (auto-recon); refunds API for cancellation refunds.
- **eNACH (auto-debit mandates):** mandate creation for CLP installments (Razorpay Route/Subscriptions or NBBL eNACH via partner); debit scheduling from demand calendar; failure → retry ladder + dunning; mandate status lifecycle tracked per unit.
- **Payouts (Razorpay X / bank files):** vendor payment runs, broker commissions, refunds, payroll disbursement (or payroll partner's rail). Bank file formats (NEFT/RTGS batch) as fallback; debit-advice webhook → payment.cleared.
- **Escrow note:** RERA-designated accounts are managed at tenant's bank; BuildOS tracks classification and statements (uploads/API where bank supports) — does not hold client money.

## 5. eSign & stamping (Leegality adapter; DocuSign alternative)

- **Aadhaar eSign** for AFT, booking forms, amendments; bulk-sign for channel partner agreements; document prefill via template variables from booking data; signer flow (mobile OTP + Aadhaar OTP) tracked; signed PDF + audit certificate vaulted; webhook on completion → `aft.executed`.
- **Stamp duty:** state-dependent (e-stamping portals/SHCIL/agreement online registration); Phase 1: record-keeping + checklist; Phase 5: integrations where APIs exist (e.g., Maharashtra e-registration status fetch).

## 6. Accounting sync (Tally primary; Zoho Books adapter)

- **Tally:** voucher push (sales, receipts, purchases, payments, journals) via Tally XML gateway (OData) through a lightweight on-prem connector or scheduled import file; per-entity company mapping; day-wise posting; control totals + recon report; period lock enforcement (no voucher sync into closed periods).
- **Zoho Books:** REST adapter with same voucher contract.
- BuildOS remains sub-ledger of record (customer ledger, vendor ledger, project costs); GL is Tally's. Mismatch report is a first-class screen (Finance → Tally Sync).

## 7. Lead sources

| Source | Method | Notes |
|---|---|---|
| Meta Lead Ads | Graph API poll (5 min) + webhooks | Campaign/Ad mapping → Marketing attribution |
| Google Ads lead forms | Zapier-free: API via connector service | UTM enforcement |
| 99acres / MagicBricks / Housing / NoBroker | Webhooks (where offered) or email-parse bridge | Map to `Lead.source`, project routing rules |
| Website / landing pages | Embeddable widget + `/api/leads` (HMAC-signed) | reCAPTCHA/honeypot, rate-limited |
| IVR / Cloud telephony (Exotel, Ozonetel) | Call detail webhooks + recording URLs | Auto-lead on missed call; click-to-call from CRM; disposition capture |
| Channel partners | Partner portal import (CSV/API) | Credit-window rules (BR-3C) applied |

**Dedup & routing service** (CRM ctx) is the single entry point: normalize phone (+91), match against tenant contacts, decide new/merge/opportunity-link, route per assignment rules, trigger ack journey.

## 8. RERA portals

- No uniform public API across states. Approach: **structured data out** — QPR payloads exported per state schema (MahaRERA/K-RERA/TN-RERA/TS-RERA formats) with attachment bundles; compliance officers upload to portals manually in Phase 1–2; **Phase 5:** browser-automation/RPA-lite helper + where states expose APIs (e.g., MahaRERA citizen APIs), auto-fetch registration status, complaint status, and filing acknowledgements; acknowledgement docs auto-vaulted.

## 9. AI services (Phase 5)

- **LLM gateway** (self-hosted router → OpenAI/Gemini/Claude per task): lead scoring explanations, ERP copilot (NL→semantic-layer query, permission-scoped), QPR narrative drafts, site-report summaries, call-transcript summarization (IVR recordings → STT → summary).
- **Document AI:** AWS Textract (invoices, KYC) + custom extraction schemas; confidence thresholds → auto-accept vs exception queue.
- Guardrails: no PII to LLM providers beyond necessity (masking middleware), tenant data-use consent flags, opt-out of AI features per tenant, all AI outputs marked and human-confirmable.

## 10. Integration test & operations

- Contract tests per adapter (VCR-style cassettes + provider sandbox); webhook replay tool; `integration_call` dashboard with success rates per provider; on-call runbooks per provider outage (failover matrix in 03 §6); secrets rotation calendar.
