# 10 — Sales & Marketing Integrations Catalog

Deep-dive companion to `05 §7` (lead sources) and `05 §1–3` (channels). Every row: direction, contract, auth, failure mode, and phase. All adapters sit behind ports (`LeadSourcePort`, `AdsPort`, `TelephonyPort`, `TrackingPort`) — vendors are swappable.

## 1. Lead capture (inbound → CRM)

| # | Integration | Mechanism | Contract / notes | Phase |
|---|---|---|---|---|
| 1 | **Meta Lead Ads** | Graph API webhook + 5-min poll fallback | Page→form→project mapping; `campaign_id/ad_id/adset_id` persisted; instant WhatsApp ack | P1 |
| 2 | **Google Ads lead forms** | Google Ads API lead webhook via connector | Same envelope as Meta; gclid retained for attribution | P1 |
| 3 | **99acres / MagicBricks / Housing / NoBroker** | Native webhooks where offered; email-parse bridge otherwise | Generic `LeadSourcePort` JSON; source quality flags; nightly reconciliation of lead counts | P1 |
| 4 | **Website / landing pages** | Embeddable widget + HMAC-signed `POST /v1/leads` | GTM/GA4 client_id captured → attribution; reCAPTCHA/honeypot; rate limits | P1 |
| 5 | **Cloud telephony (Exotel/Ozonetel/MyOperator)** | Call-detail webhooks + click-to-call + recording URLs | Missed call → auto-lead; recording → STT → disposition suggestion; number masking for exec privacy | P1 |
| 6 | **IVR campaigns** | Exotel flow → number → CRM campaign tag | Missed-call-to-lead for print/outdoor ("Give missed call…") | P1 |
| 7 | **WhatsApp inbound** | Cloud API messages webhook | Thread → lead/opportunity timeline; bot qualification (Phase 5 AI SDR) | P1 |
| 8 | **Channel partner imports** | Partner portal CSV/API | Credit-window rules; dedup against house leads (first-touch wins by policy) | P1 |
| 9 | **Walk-in / event capture** | Staff app + QR check-in | Auto lead + visit record; event tag for attribution | P1 |
| 10 | **Third-party CRM sync (optional)** | Import/export adapters: Zoho CRM, HubSpot, Salesforce | For tenants keeping legacy CRM during transition — one-way mirror with field map | P2 |

## 2. Sales-cycle integrations (mid-funnel)

| # | Integration | Purpose | Notes | Phase |
|---|---|---|---|---|
| 11 | **Razorpay payment links / PG** | Booking amount + installment collections | Deep-linked from WhatsApp; `payment.captured` → receipt (05 §4) | P2 |
| 12 | **eNACH mandates (Razorpay/NBBL)** | Auto-debit of CLP installments | Mandate lifecycle per unit | P2 |
| 13 | **KYC verification (Surepass / Signzy / IDfy / DigiLocker)** | PAN/Aadhaar validation, DigiLocker fetch, bank-account (penny-drop) verification | OCR + API verify; fraud scoring (duplicate PAN across bookings) | P1–2 |
| 14 | **Aadhaar eSign (Leegality/NexVerse)** | AFT, booking forms, partner agreements | 05 §5 | P1 |
| 15 | **Home-loan partner desk (manual-assist)** | Lead handoff pack to HDFC/SBI/LIC HFL desks; status back via portal/API where offered | No public APIs for most — structured referral + status poll/email-parse; DSA commission ledger | P2 |
| 16 | **Listing syndication** | Inventory feed → 99acres/MagicBricks/Housing | CSV/API per portal; RERA-compliant fields only (BR-C); sold-status sync D+1 | P2 |
| 17 | **Calendly-style visit scheduling** | Native slots + Google Calendar sync (OAuth) | Site visit slots for senior sales/premium projects | P2 |

## 3. Marketing execution & measurement integrations

| # | Integration | Direction | Contract / notes | Phase |
|---|---|---|---|---|
| 18 | **Meta Marketing API** | Pull (hourly) | Campaign/adset/ad spend + impressions/clicks/leads; creative status; budget pacing alerts | P3 |
| 19 | **Meta Conversions API (CAPI)** | Push (event) | Server-side lead/booking events with dedup (event_id = lead id); improves optimization signal | P3 |
| 20 | **Google Ads API** | Pull (hourly) | Spend/conversions per campaign; offline conversion import (visit/booking) | P3 |
| 21 | **Google Enhanced Conversions / GA4 Data API** | Push + pull | Consent-mode aware; GA4 audience sync for remarketing | P3 |
| 22 | **UTM governance service** | Internal | Every outbound link signed & UTM-stamped; unknown-UTM quarantines | P1 |
| 23 | **WhatsApp catalog & flows** | Push | Inventory catalog per project; flow-based requirement capture (bot) | P2 |
| 24 | **Email/SMS campaign rails** | Push | Journey engine (05 §1–3); promo lists respect DND + DPDP consent | P1 |
| 25 | **Social publishing (Meta Pages/IG Graph API)** | Push | Post scheduling + RERA reg-no compliance check pre-publish; UTM auto-append | P3 |
| 26 | **Print / outdoor / events tracker** | Manual + QR/NFC | QR codes per asset → landing page with asset UTM → spend entry linked; event QR check-in (row 9) | P2 |
| 27 | **Referral engine** | Internal + WhatsApp share | Unique referral codes per customer/partner; attribution on lead conversion; payout via commission ledger | P2 |
| 28 | **Call tracking (dynamic number insertion)** | Pull | Per-campaign virtual numbers (Exotel); ties calls to campaigns for CPL-by-channel accuracy | P2 |
| 29 | **BI export / reverse ETL** | Push | Warehouse → Looker Studio/Metabase/Power BI for agency scorecards; API tokens scoped read-only | P3 |

## 4. Data & attribution model (how it all joins)

```
Touch: {touch_id, person_id, ts, channel, source, campaign_id, creative_id,
        utm{...}, gclid/fbclid, device, ip-hashed}
person → lead → opportunity → booking   (identity resolution: phone+91, email, PAN)
```
- **Attribution job** nightly + on booking event; models: first-touch, last-touch, linear; CPB/CAC per campaign.
- **Consent gating:** CAPI/Enhanced Conversions fire only for consented profiles (DPDP ledger check).
- **Reconciliation:** Meta/Google spend vs finance AP entries (marketing bills) monthly variance report → exception queue (07 §5).

## 5. Non-functional for all integrations

Circuit breaker + retry with backoff; per-vendor rate-limit budgets (Meta: 200 calls/hour app-level — batch reads); webhook signature verification + replay protection; sandbox/staging credentials per vendor; cost dashboard (API usage, WhatsApp conversations, SMS); vendor failover matrix (e.g., telephony vendor outage → manual call tasks).
