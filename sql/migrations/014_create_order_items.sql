-- Migration 014 — order_items
-- Line items inside an order.
-- ADR-010: price and name COPIED at purchase time.
-- Old orders never change even if prices are edited later.

CREATE TABLE IF NOT EXISTS order_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  order_id         UUID        NOT NULL REFERENCES orders(id)           ON DELETE CASCADE,
  variant_id       UUID        REFERENCES product_variants(id)          ON DELETE SET NULL,
  product_name     TEXT        NOT NULL,
  variant_label    TEXT,
  unit_price_cents INTEGER     NOT NULL CHECK (unit_price_cents >= 0),
  quantity         INTEGER     NOT NULL CHECK (quantity > 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX order_items_order_idx  ON order_items (order_id);
CREATE INDEX order_items_tenant_idx ON order_items (tenant_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON order_items
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);