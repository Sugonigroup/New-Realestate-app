# Procurement Workspace — Approach A (surface existing APIs)

Date: 2026-09-01
Status: approved for spec review
Scope: ERP procurement hub over existing vendor/PR/RFQ/PO/GRN/RA services. Do not merge the two ProcurementService classes. Do not build payment-run or vendor portal.

## Goal

Make the Verde sourcing loop operable in ERP: indent → RFQ comparison → award PO → GRN → RA bill list. API is the system of record. UI is presentation plus forms that call existing POSTs.

Finance AP match stays amount-in, not live PO/GRN. PO-0001 `totalPaise` remains `24_500_000_00n`.

## Non-goals

- Payment run / Razorpay X / maker-checker release
- Vendor portal RFQ inbox
- Merging `src/procurement` with `src/projects/procurement` (RA bills)
- Relocating RA routes off `/v1/procurement`
- CLRA compliance gate, WO/BOQ editor, stock ledger screens
- Linking RA bills to PO/GRN

B later can add those without replacing these list GETs or `/procurement` routes.

## Controls

- Server-side state machines stay in ProcurementService (quotes only on open RFQs, GRN qty capped at PO balance, award refuses duplicate poNo)
- RBAC unchanged: `procurement.read` lists; writes use `procurement.vendor.create`, `procurement.requisition.create`, `procurement.po.approve`, `procurement.rfq.create`, `procurement.grn.create`
- RA submit stays `procurement.po.create` (existing)
- Money: bigint paise; JSON strings via existing `BigInt.prototype.toJSON`
- Unique: vendor code, reqNo, rfqNo, poNo, grnNo

## APIs (new reads)

| Method | Path | Permission |
|---|---|---|
| GET | /v1/procurement/dashboard | procurement.read |
| GET | /v1/procurement/vendors | procurement.read |
| GET | /v1/procurement/prs | procurement.read |
| GET | /v1/procurement/rfqs | procurement.read |
| GET | /v1/procurement/rfqs/:id | procurement.read |
| GET | /v1/procurement/orders | procurement.read |
| GET | /v1/procurement/grns | procurement.read |

Existing: POST vendors/prs/rfqs/quotes/award/grns; GET rfqs/:id/comparison; GET/POST ra-bills. Comparison and award stay on the current controller.

Dashboard KPIs from those lists: draft PR count, open RFQ count, open PO count, GRN count, RA bills with anomalies.

Two Nest controllers already share `@Controller("procurement")`. New GETs go on `src/procurement/procurement.controller.ts` only. RA list stays on `src/projects/procurement.controller.ts`.

## Screens

ERP_NAV Procurement `href: "/procurement"`.

Layout subnav: Dashboard, Vendors, PRs, RFQs, POs, GRNs, RA bills.

| Route | Behavior |
|---|---|
| /procurement | KPI tiles + exceptions (draft PRs, open RFQs, RA anomalies) |
| /procurement/vendors | List + create (code, name, GSTIN). Rating via existing GET vendors/:id/rating |
| /procurement/prs | Replace mock page. List by status. Raise PR (Verde projectId + lines). Approve draft |
| /procurement/rfqs | List. Create RFQ from approved PR. Quote entry. Comparison table (L1). Award → PO |
| /procurement/pos | List POs (GET /v1/procurement/orders) with vendor, status, total, receivedInFull |
| /procurement/grns | List + receive form (orderId, lines with poLineId/qty/acceptedQty) |
| /procurement/ra-bills | Keep list; add submit form (BOQ/MB fields, existing POST) |

Empty/error states when API fails. Tokens, StatCard, MoneyText, RSC + client forms (same as finance).

## Seed

Idempotent helper called from `prisma/seed.ts` after the existing PO-0001 create.

If PO-0001 already exists without vendor/lines (current seed), backfill rather than calling `awardQuote` (that method rejects duplicate poNo).

- Vendors: `ultratech` (L1), plus two quote-only vendors
- PR-0001: OPC 53 cement, status converted, est total `24_500_000_00n`
- RFQ-0001: awarded; three quotes; Ultratech accepted at `24_500_000_00n`; others higher
- PO-0001: vendorId ultratech, one line, totalPaise unchanged, status received, receivedInFull true
- GRN-0001: accepted qty = PO qty

Do not change finance seed invoice/PO paise.

## Testing

- procurement.test.ts: list vendors/PRs/RFQs/POs/GRNs; dashboard counts; award still refuses duplicate poNo
- nav.test.ts: Procurement href `/procurement`
- tsc core-api + erp-web

## Extension points (do not build now)

RA bill linked to PO/GRN; payment run; vendor portal; single ProcurementModule; CLRA gate on award.
