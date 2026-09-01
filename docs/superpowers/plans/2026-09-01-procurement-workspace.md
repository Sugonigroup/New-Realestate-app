# Implementation plan — Procurement workspace A

1. List + dashboard methods on `ProcurementService`; GET routes on `src/procurement/procurement.controller.ts`.
2. Extend `procurement.test.ts` fake prisma findMany; list/dashboard tests; duplicate poNo still fails.
3. `prisma/seed-procurement.ts` backfill PO-0001 chain; call from `seed.ts`.
4. ERP: nav href, layout/subnav, dashboard, vendors, PRs (replace mock), RFQs, POs, GRNs, RA submit form.
5. `nav.test.ts` Procurement href; tsc core-api + erp-web.
