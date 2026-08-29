# 26 — Production Readiness Checklist

Gate to declare production. Status now: **all items open — nothing is built** (see `02 §3`). Each line is checked only with evidence (link to test run, drill report, or review record).

## 1. Platform

- [ ] All Phase 0–5 acceptance demos executed by PO on staging (`../../phases/`)
- [ ] CI/CD: lint/type/test/contract/scan green; preview + staging deploys automated; rollback drill passed
- [ ] IaC covers full topology; no manual prod changes (drift detection on)
- [ ] Environments hardened: prod access via SSO+JIT; secrets rotated; no secrets in repo

## 2. Security

- [ ] OWASP ASVS L2 closed; external VAPT: zero criticals/highs
- [ ] Authz fuzz (roles + agent identities) zero leaks; RLS cross-tenant probe suite green
- [ ] PII encryption verified (Aadhaar/PAN/bank); masking middleware in LLM gateway verified
- [ ] DPDP pack: consents, DSAR workflows, breach runbook, grievance officer configured
- [ ] Prompt-injection red-team suite: 0 successful injections/actions

## 3. AI governance

- [ ] Autonomy policy (10) reviewed by tenant + signed; L5 list enforced in registry (negative tests)
- [ ] Every agent: allowlist, ceiling, budgets, kill-switch tested
- [ ] Eval suites green (extraction ≥98%, routing 100%, regression clean)
- [ ] AI audit chain complete for sampled actions (agent→decision→approval→result)
- [ ] Shadow→prod promotion runbook executed once per agent

## 4. Data & money

- [ ] Money golden-file suite 100%; Tally sync reconciliation signed by tenant CA
- [ ] RERA QPR export validated for each active state profile (consultant sign-off)
- [ ] Backup + restore drill passed (RPO/RTO evidence); cross-region copy verified
- [ ] Data migration reconciled (control totals match; shadow parallel <0.5% variance 2 consecutive weeks)

## 5. Operations

- [ ] SLOs instrumented + alert runbooks (`21`); on-call rota staffed
- [ ] Load test: 500 rps burst + agent storm green
- [ ] Failover game day passed (WhatsApp outage, provider outage, AZ drill)
- [ ] AI ops dashboard live (D14); cost budgets enforced (28)
- [ ] Runbooks + training complete; hypercare rota 2 weeks staffed

## 6. Business

- [ ] UAT sign-off matrix complete (`../../phases/phase-6 WP-6D`)
- [ ] Anchor-tenant go-live checklist executed; launch war-room plan ready
- [ ] Support model L1/L2 defined; tenant onboarding runbook (<1 day target)

**Verdict model:** production-ready = every box checked with evidence. MVP exit (Phase 6) allows ERP-in-production with AI in shadow-only; full AI-operated production requires §3 complete.
