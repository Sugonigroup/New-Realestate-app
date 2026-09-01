# P0 Finance Backbone — Approach A (strengthened)

Date: 2026-08-31
Status: approved for implementation
Scope: Surface existing GL/AP/bank/AR services as a complete Finance module in ERP. Do not implement Approach B posting engine.

## Goal

Make BuildOS the operable books of record for a 100 Cr Indian residential developer (Verde Residences / Shree Developers) without treating Tally as a second ledger.

The UI must be a finance workspace (dashboard, CoA, GL, journals, TB, AP, AR, bank, periods, audit), not a thin wrapper around POST endpoints.

## Non-goals (B, later)

- Automatic subledger to GL posting
- Loading live PO/GRN totals (A match still accepts amounts; seed values match PO-0001)
- Journal.entityId, intercompany pairs, payment-run dual control
- Cost-center master table

B must be additive: same GlService createJournal / postJournal / reverseJournal, same tables, same /finance routes.

## Controls (day one)

- Double-entry: create rejects unbalanced or zero journals
- Posted journals are immutable; corrections via reversal voucher, never edit/delete
- Period lock: FiscalPeriod status open, soft_closed, hard_closed; assertPeriodOpen on create/post/reverse
- Soft close blocked if draft journals exist in that month
- AuditEvent on post, reverse, period close, AP match, bank import/match
- RBAC: finance.read lists; finance.journal.create / finance.journal.post; finance.period.close (CFO via finance.*)
- Idempotency: unique voucherNo, vendorId+invoiceNo, bank utr
- Money: bigint paise only; JSON string via existing BigInt.prototype.toJSON
- Server-side Zod + service validation

Tally (finance/tally.ts) remains export/XML. It is not written by these screens.

## APIs (new reads + period close)

| Method | Path | Permission |
|---|---|---|
| GET | /v1/gl/dashboard | finance.read |
| GET | /v1/gl/accounts | finance.read |
| GET | /v1/gl/journals | finance.read |
| GET | /v1/gl/journals/:id | finance.read |
| GET | /v1/gl/ledger?accountCode= | finance.read |
| GET | /v1/gl/periods | finance.read |
| POST | /v1/gl/periods/:period/close | finance.period.close |
| GET | /v1/gl/audit | finance.read |
| GET | /v1/gl/ap/invoices | finance.read |
| GET | /v1/gl/bank/accounts | finance.read |
| GET | /v1/gl/bank/transactions | finance.read |
| GET | /v1/finance/ar/aging | finance.read |

Existing writes stay. Journal create/post use finance.journal.create / finance.journal.post. Accountant and finance_manager gain those grants.

## Dashboard KPIs

Cash and bank, receivables, payables, customer advances, revenue, expenses, project profitability, overdue receivables, unmatched bank transactions, current-period status.

## Screens

/finance dashboard, /finance/coa, /finance/gl, /finance/journals, /finance/journals/new, /finance/trial-balance, /finance/ap, /finance/ar, /finance/bank, /finance/periods, /finance/audit. Existing demands/collections/escrow remain. ERP_NAV Finance href /finance.

## Seed

Indian RE CoA (~30 accounts). FY 2026-27 monthly periods. Opening + operational journals at Verde 100 Cr GDV scale. Sample AP, bank UTR match/unmatch, bookings/demands for aging.

## Testing

gl.test.ts list/close/ledger; reverse uses transaction; aging includes due; nav Finance href; tsc core-api and erp-web.

## B extension points (do not build now)

Journal.sourceType+sourceId, Journal.entityId, AP match loads PO/GRN, payment run, close checklist.
