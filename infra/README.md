# Infrastructure (WP-0B)

| Piece | Location | Status |
|---|---|---|
| Local dev stack (pg 16 + redis 7 + api + web) | `docker-compose.yml` | ready — `docker compose up` |
| Core API image | `services/core-api/Dockerfile` | ready (multi-stage, non-root) |
| ERP web image | `apps/erp-web/Dockerfile` | ready (standalone output) |
| Staging/prod Terraform | `infra/terraform/main.tf` | skeleton — see below |

## Staging deployment steps (when AWS credentials are available)

1. Configure the Terraform S3 backend + AWS auth (`UNKNOWN — REQUIRES CONFIRMATION`: AWS account id, Route53 domain, ACM certificate ARN, ECR repo names).
2. `terraform init && terraform workspace new staging && terraform apply` — RDS Postgres 16 (Multi-AZ, 35-day PITR, pgvector preload), ElastiCache Redis 7, S3 documents bucket (KMS + versioning), ECS cluster.
3. CI (`.github/workflows/ci.yml`) gains a deploy job: build/push images to ECR → `aws ecs update-service` (rolling). Secrets move from variables to AWS Secrets Manager with rotation.
4. One-off: `prisma migrate deploy` + `prisma/rls.sql` + `prisma/seed.ts` against staging RDS; create `app_user` (NOSUPERUSER) for the API task role so RLS is enforced end-to-end.
5. Wire Datadog/Grafana Cloud + Sentry DSNs (`03 §4`, `21`); WAF + CloudFront per `23`.

## Verification evidence so far

- RLS cross-tenant probe passed against a live Postgres 16 container (0 rows without tenant GUC / 0 rows wrong tenant / correct rows with tenant) — see commit `a67a964`.
- Full DB re-verification of the newer tables (workflow, notifications, documents) is queued on the local Docker daemon recovery.
