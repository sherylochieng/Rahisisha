-- Migration 012 — inventory_movements
-- Full audit trail of every stock change ever.
-- ADR-008: never just update a number, always write a row.
-- "Why is stock at 3?" has a real queryable answer.

CREATE TABLE IF NOT EXISTS inventory_movements (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  variant_id   UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL
                           CHECK (type IN ('sale','release','adjustment','return','import')),
  quantity     INTEGER     NOT NULL,
  reference_id UUID,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX inventory_movements_variant_idx ON inventory_movements (variant_id, created_at DESC);
CREATE INDEX inventory_movements_tenant_idx  ON inventory_movements (tenant_id, created_at DESC);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON inventory_movements
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);