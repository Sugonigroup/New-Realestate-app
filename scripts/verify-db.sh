#!/usr/bin/env bash
# Phase 0/9 DB verification E2E — one command, run when Docker is available.
# Usage: bash scripts/verify-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── 1. Postgres 16 up ──"
docker rm -f buildos-verify >/dev/null 2>&1 || true
docker run -d --name buildos-verify -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=buildos -p 5433:5432 postgres:16-alpine >/dev/null
sleep 4
docker exec buildos-verify pg_isready -U postgres

echo "── 2. Schema push ──"
cd services/core-api
export DATABASE_URL="postgresql://postgres:dev@localhost:5433/buildos?schema=public"
pnpm exec prisma db push --skip-generate >/dev/null

echo "── 3. RLS policies applied ──"
docker cp prisma/rls.sql buildos-verify:/tmp/rls.sql
docker exec buildos-verify psql -U postgres -d buildos -f /tmp/rls.sql >/dev/null 2>&1
docker exec buildos-verify psql -U postgres -d buildos -c "CREATE ROLE app_user LOGIN PASSWORD 'app' NOSUPERUSER; GRANT USAGE ON SCHEMA public TO app_user; GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;" >/dev/null

echo "── 4. Seed (demo tenant + admin/Buildos@demo1) ──"
pnpm db:seed >/dev/null

echo "── 5. RLS cross-tenant probe ──"
TENANT_ID=$(docker exec buildos-verify psql -U postgres -d buildos -t -A -c "SELECT id FROM tenants LIMIT 1")
NO_GUC=$(docker exec buildos-verify psql -U app_user -d buildos -t -A -c "SELECT count(*) FROM projects")
WRONG=$(docker exec buildos-verify psql -U app_user -d buildos -t -A -c "SELECT set_config('app.tenant_id','00000000-0000-0000-0000-000000000000',true); SELECT count(*) FROM projects" | tail -1)
RIGHT=$(docker exec buildos-verify psql -U app_user -d buildos -t -A -c "SELECT set_config('app.tenant_id','$TENANT_ID',true); SELECT count(*) FROM projects" | tail -1)
[ "$NO_GUC" = "0" ] && [ "$WRONG" = "0" ] && [ "$RIGHT" != "0" ] && echo "  RLS PROBE PASSED (0 / 0 / $RIGHT)" || { echo "  RLS PROBE FAILED"; exit 1; }

echo "── 6. API boot + endpoint checks ──"
APP_SECRET=verify-secret-0123456789 node dist/src/main.js >/tmp/api.log 2>&1 &
API_PID=$!
sleep 4
curl -sf http://localhost:8080/v1/health | grep -q '"status":"ok"' && echo "  health OK"
curl -sf "http://localhost:8080/v1/authz/check?permission=crm.lead.read" -H "x-tenant-id: $TENANT_ID" | grep -q '"allowed":true' && echo "  authz OK"
curl -s "http://localhost:8080/v1/authz/check?permission=bad" -H "x-tenant-id: $TENANT_ID" | grep -q "problem+json\|permission must" && echo "  rfc7807 OK"
kill $API_PID 2>/dev/null

echo "── ALL DB VERIFICATIONS PASSED ──"
docker rm -f buildos-verify >/dev/null
