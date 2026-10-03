-- Migration 020 — audit_logs
-- Every privileged or financial action ever taken.
-- Who did what, to what, before and after.
-- NO RLS — platform admin needs full access across all tenants.

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        REFERENCES tenants(id) ON DELETE SET NULL,
  actor_id    UUID        REFERENCES users(id)   ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  resource    TEXT        NOT NULL,
  resource_id UUID,
  before      JSONB,
  after       JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX audit_logs_tenant_idx   ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_logs_resource_idx ON audit_logs (resource, resource_id);