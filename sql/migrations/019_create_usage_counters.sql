-- Migration 019 — usage_counters
-- AI message usage per tenant per month.
-- Enforces plan caps: starter=1000, growth=4000, pro=8000/month.

CREATE TABLE IF NOT EXISTS usage_counters (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  month        DATE        NOT NULL,
  ai_messages  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX usage_counters_tenant_month_unique ON usage_counters (tenant_id, month);

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON usage_counters
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);