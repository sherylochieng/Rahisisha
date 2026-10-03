-- Migration 011 — stock_reservations
-- Holds stock when a customer taps Buy — before payment confirms.
-- ADR-007: reserve-then-confirm. Stock NEVER drops until
-- Safaricom's server-side callback confirms the payment.
-- BullMQ releases expired reservations automatically.

CREATE TABLE IF NOT EXISTS stock_reservations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  variant_id  UUID        NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity    INTEGER     NOT NULL CHECK (quantity > 0),
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','confirmed','released','expired')),
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stock_reservations_variant_idx
  ON stock_reservations (variant_id, status);
CREATE INDEX stock_reservations_expires_idx
  ON stock_reservations (expires_at) WHERE status = 'pending';
CREATE INDEX stock_reservations_tenant_idx
  ON stock_reservations (tenant_id);

ALTER TABLE stock_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_reservations FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON stock_reservations
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);