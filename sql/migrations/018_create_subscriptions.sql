-- Migration 018 — subscriptions
-- Which plan each tenant is on and when it renews.
-- One subscription per tenant (UNIQUE on tenant_id).

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  plan                 TEXT        NOT NULL DEFAULT 'starter'
                                   CHECK (plan IN ('starter','growth','pro')),
  status               TEXT        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('active','past_due','cancelled')),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX subscriptions_tenant_idx ON subscriptions (tenant_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON subscriptions
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);