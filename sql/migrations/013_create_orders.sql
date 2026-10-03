-- Migration 013 — orders
-- Confirmed purchases. Status machine:
-- created → paid → packed → sent → delivered (or cancelled)

CREATE TABLE IF NOT EXISTS orders (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  customer_id  UUID        NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status       TEXT        NOT NULL DEFAULT 'created'
                           CHECK (status IN ('created','paid','packed','sent','delivered','cancelled')),
  channel      TEXT        NOT NULL DEFAULT 'whatsapp'
                           CHECK (channel IN ('whatsapp','web','ussd')),
  total_cents  INTEGER     NOT NULL CHECK (total_cents >= 0),
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX orders_tenant_status_idx  ON orders (tenant_id, status, created_at DESC);
CREATE INDEX orders_customer_idx       ON orders (customer_id);
CREATE INDEX orders_tenant_created_idx ON orders (tenant_id, created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);