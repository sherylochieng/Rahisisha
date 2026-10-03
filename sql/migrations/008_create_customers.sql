-- Migration 008 — customers
-- People who buy from a tenant's shop. Tenant-scoped.
-- Same phone can shop at multiple businesses but each
-- business has their own customer record for that phone.

CREATE TABLE IF NOT EXISTS customers (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone       TEXT        NOT NULL,
  name        TEXT,
  channel     TEXT        NOT NULL DEFAULT 'whatsapp'
                          CHECK (channel IN ('whatsapp', 'web', 'ussd')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX customers_tenant_phone_unique ON customers (tenant_id, phone);
CREATE INDEX        customers_tenant_idx          ON customers (tenant_id);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);
  