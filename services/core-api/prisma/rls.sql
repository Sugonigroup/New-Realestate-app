-- Tenant isolation via Postgres RLS (ADR-02, docs/architecture/05 §4).
-- Applied after `prisma migrate deploy` (see services/core-api/src/prisma/README.md).
-- The application sets `app.tenant_id` per request/transaction (PrismaService.withTenant).

DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'org_entities', 'verticals', 'projects', 'units', 'users', 'roles',
    'user_roles', 'sessions', 'audit_event', 'outbox', 'number_series'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    -- Tenant can see only its rows; service role bypasses via BYPASSRLS (migrations).
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
    $f$, t);
  END LOOP;
END $$;

-- audit_event and number_series are append/immutable: no UPDATE/DELETE grants at the
-- application DB role level (grant management is applied at provisioning, Phase 0 WP-0B).
