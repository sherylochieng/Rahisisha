-- Migration 007 — product_media
-- Original + enhanced photos per product.
-- ADR-015: enhance the real photo, never generate a fake one.
-- original_url is ALWAYS kept. Nothing goes public until approved = TRUE.

CREATE TABLE IF NOT EXISTS product_media (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id)          ON DELETE CASCADE,
  product_id    UUID        NOT NULL REFERENCES products(id)         ON DELETE CASCADE,
  variant_id    UUID        REFERENCES product_variants(id)          ON DELETE SET NULL,
  original_url  TEXT        NOT NULL,
  enhanced_url  TEXT,
  approved      BOOLEAN     NOT NULL DEFAULT FALSE,
  approved_at   TIMESTAMPTZ,
  position      INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX product_media_product_idx ON product_media (product_id, position);
CREATE INDEX product_media_tenant_idx  ON product_media (tenant_id);

ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON product_media
  USING (tenant_id = current_setting('app.current_tenant', TRUE)::UUID);