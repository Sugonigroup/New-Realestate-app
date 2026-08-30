# Live Adapter Setup Guide — Manual Configuration

Step-by-step manual settings for every external provider. Each section maps dashboard actions → credentials → the exact env vars the code reads → a verification test. Until credentials exist, all adapters run in stub/sandbox mode (documented per adapter).

---

## 1. Razorpay — payments, eNACH mandates, payouts (WP-2B/3H)

### 1.1 Dashboard setup
1. Create account at dashboard.razorpay.com → complete **KYC** (business PAN, GST, bank statement, MOA) — needed before live mode unlocks.
2. **Settings → API Keys → Generate Test Keys**, then repeat in **Live mode** after KYC approval.
3. **Settings → Webhooks → Add New Webhook**:
   - URL: `https://<core-api-domain>/v1/payments/webhook/razorpay`
   - Secret: generate a strong secret (this is the `RAZORPAY_WEBHOOK_SECRET`)
   - Active events: `payment.captured`, `payment.failed`, `refund.processed`
4. **eNACH mandates**: enable Subscriptions/Route (or Max), complete mandate registration KYC.
5. **Razorpay X** (payouts for vendor/commission payment runs): enable + add current account.

### 1.2 Credentials → env/secrets
| Dashboard item | Env var (core-api) | Store |
|---|---|---|
| Key ID | `RAZORPAY_KEY_ID` | Secrets Manager → `buildos/{env}/razorpay` |
| Key Secret | `RAZORPAY_KEY_SECRET` | same |
| Webhook secret | `RAZORPAY_WEBHOOK_SECRET` | same |
| X API key (payouts) | `RAZORPAYX_KEY_ID` / `RAZORPAYX_KEY_SECRET` | same |

### 1.3 Code wiring (already implemented)
- `services/core-api/src/finance/razorpay-webhook.ts` — signature verification (HMAC-SHA256 of raw body) + `payment.captured` → `FinanceService.applyReceipt` mapping. **Webhook receipt is paise-native — no conversion.**
- Endpoint to add at activation: `POST /v1/payments/webhook/razorpay` reading raw body (`rawBody: true` already enabled).
- Idempotency: `instrumentRef = pay_xxx` → unique constraint on `receipts` blocks double-receipt.

### 1.4 Verification checklist
- [ ] Test-mode payment link → `payment.captured` webhook received → receipt row `status=cleared`, `gatewayRef=pay_…`
- [ ] Replay the same webhook → no second receipt (duplicate-ref guard)
- [ ] Signature mismatch (tamper test) → 403 problem+json
- [ ] Unattributable payment (no bookingId note) → exceptions queue, not a receipt

---

## 2. WhatsApp Cloud API (Meta) — WP-0H primary channel

### 2.1 Meta setup
1. developers.facebook.com → Create App → type **Business**.
2. Add product **WhatsApp** → link/create a **WABA** (WhatsApp Business Account) under your verified Meta Business (business verification mandatory).
3. Add a phone number (virtual number fine; must not be registered on the consumer app).
4. **Business verification + display name approval** — both required before >250 unique recipients/day.
5. **Templates → Create & submit** for each template key in `notification_templates` (see table in `05 §1`): categories utility/marketing; submission review takes minutes–days.
6. **Webhook**: App → WhatsApp → Configuration → Callback URL `https://<core-api-domain>/v1/notifications/webhook/whatsapp`, Verify Token = `WHATSAPP_VERIFY_TOKEN`; subscribe to `messages` fields.
7. Generate a **permanent System User access token** (Business Settings → Users → System Users, role Admin, add WhatsApp assets) — temporary tokens expire in 24 h.

### 2.2 Credentials → env/secrets
| Item | Env var |
|---|---|
| System user token | `WHATSAPP_TOKEN` |
| Phone number ID | `WHATSAPP_PHONE_NUMBER_ID` |
| WABA ID | `WHATSAPP_WABA_ID` |
| Webhook verify token | `WHATSAPP_VERIFY_TOKEN` |
| App secret (webhook signature) | `META_APP_SECRET` |

### 2.3 Code wiring
- Template approval status lives in `notification_templates.approval_status` — the hub refuses to send on unapproved templates (already enforced + tested).
- Live adapter replaces `ConsoleNotificationAdapter` (same `NotificationPort`): POST `graph.facebook.com/v20.0/{phoneId}/messages`.
- Webhook handler: verify `X-Hub-Signature-256` with `META_APP_SECRET`, dedupe by message id, feed inbound to CRM, status callbacks to `message_log`.

### 2.4 Verification checklist
- [ ] Sandbox test message delivers to a registered number
- [ ] Template approved (status shown in `notification_templates`) → send OK; unapproved → hub refuses
- [ ] STOP keyword → consent ledger revoked → next send suppressed
- [ ] Quiet hours: S2 deferred with `defer_until`; S0 (OTP) delivers at night
- [ ] Pricing dashboard: conversations tracked in `agent_runs`/cost rows

---

## 3. eSign — Leegality (Aadhaar eSign) — WP-1D AFT execution

### 3.1 Leegality setup
1. Onboard with Leegality → sign PSA; get API credentials + sandbox.
2. Register a **template** for the AFT per state-approved format (upload DOCX, mark variable fields — the variables come from the booking payload).
3. Configure **webhook URL** `https://<core-api-domain>/v1/documents/webhook/leegality` (signed events: sent/completed/declined).

### 3.2 Credentials → env
| Item | Env var |
|---|---|
| API token | `LEEGALITY_TOKEN` |
| Webhook secret | `LEEGALITY_WEBHOOK_SECRET` |
| Environment | `LEEGALITY_MODE=sandbox\|live` |

### 3.3 Code wiring
- `BookingService.advanceAft` drives the status machine (`draft → sent → signed → registered`).
- Activation: on `draft`, call Leegality create-sign-request with the rendered template + signer (Aadhaar eSign); on completion webhook → store signed PDF into the document vault (S3 key under the booking folder) → `aft.executed` event.
- Stamp duty: record duty payment ref per state in the AFT checklist (states without APIs stay manual — tracked in the approvals register).

### 3.4 Verification checklist
- [ ] Sandbox eSign completes → signed PDF vaulted + `aftStatus=registered`
- [ ] Declined flow → status returns to `sent` with reason logged
- [ ] Audit chain: eSign certificate stored with the document version

---

## 4. SMS — MSG91 (OTP fallback + transactional)

1. Register on DLT (Jio/Infotel or Vodafone DLT portal): header (6 chars) + template IDs — DLT is mandatory in India.
2. MSG91 → DLT templates approved → note **Template IDs**; get **Auth Key**.
3. Env: `MSG91_AUTH_KEY`, `MSG91_SENDER_ID` (DLT header), `MSG91_TEMPLATE_IDS` (JSON: otp/demand/reminder → DLT template id).
4. Verification: OTP SMS delivers (S0 bypasses quiet hours), DLT-registered template only.

---

## 5. Tally connector (WP-2E)

No cloud credentials — Tally runs on-prem:
1. Tally Prime → enable OData/XML gateway (F1 → Advanced Configuration → OData port 9000).
2. Env: `TALLY_URL=http://<tally-host>:9000`, `TALLY_COMPANY=<company name>`.
3. Vouchers: builder already emits balanced Tally XML (`finance/tally.ts`) with control totals; the sync worker posts and reconciles. Period lock respected (BR: no sync into closed periods).
4. Verification: push 10 seeded vouchers → Tally trial balance matches control totals → recon report zero mismatch.

---

## 6. Secrets management (production)

- All env vars above move to **AWS Secrets Manager** (`buildos/{env}/{provider}`), rotated per the rotation calendar; ECS task roles read at boot.
- Local dev: `.env` (gitignored; see `.env.example`).
- Never in code, never in Terraform state, never in logs (the redaction middleware masks leaked values as a last resort).

---

## 7. Mode switching (stub → live)

Each adapter port has a factory reading env:
```
WHATSAPP_MODE=console|cloud      PAYMENTS_MODE=sandbox|live
EMAIL_MODE=console|ses|postmark  ESIGN_MODE=stub|leegality
SMS_MODE=console|msg91
```
`console/stub` = current Phase 0–8 defaults. Switching to live requires: credentials present + sandbox verification checklist complete + the eval/regression suites green (`pnpm test`).

---

## 8. Final go-live order (matches 26-production-readiness)

1. Razorpay test-mode → webhook verified → switch `PAYMENTS_MODE=live`
2. WhatsApp sandbox → templates approved → `WHATSAPP_MODE=cloud`
3. Leegality sandbox eSign on one AFT → `ESIGN_MODE=leegality`
4. MSG91 DLT → `SMS_MODE=msg91`
5. Tally recon zero-mismatch → enable daily sync
6. Each switch is one env change behind a feature flag — reversible without deploy.
