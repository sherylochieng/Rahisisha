-- =============================================================
-- Migration 004 — Create products table
-- Every product a business sells lives here.
-- tenant_id on every row — Amina's dresses stay with Amina.
-- =============================================================

CREATE TABLE IF NOT EXISTS products (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku         TEXT,                      -- optional product code
  name        TEXT        NOT NULL,
  description TEXT,
  price_cents INTEGER     NOT NULL CHECK (price_cents >= 0),
                                         -- stored in KES cents, never floats
                                         -- KES 350 = 35000 cents
  status      TEXT        NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'active', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ             -- soft delete: NULL = not deleted
);

-- SKU must be unique PER TENANT (not globally)
-- Amina can have SKU-001 and Brian can also have SKU-001
-- They are different businesses
CREATE UNIQUE INDEX products_tenant_sku_unique
  ON products (tenant_id, sku)
  WHERE sku IS NOT NULL AND deleted_at IS NULL;

-- Fast lookup: "show me all active products for this tenant"
-- This index is used on every storefront page load
CREATE INDEX products_tenant_status_idx
  ON products (tenant_id, status)
  WHERE deleted_at IS NULL;

-- Fast lookup: most recent products first
CREATE INDEX products_tenant_created_idx
  ON products (tenant_id, created_at DESC);

-- -------------------------------------------------------------
-- Enable RLS — products are tenant-scoped
-- Amina's products must be invisible to Brian and vice versa
-- -------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON products
  USING (
    tenant_id = current_setting('app.current_tenant', TRUE)::UUID
  );

-- =============================================================
-- Money rule: price is always stored as integer cents in KES.
-- Never store prices as floats (0.1 + 0.2 = 0.30000000000000004).
-- KES 3,500.00 is stored as 350000.
-- The frontend divides by 100 when displaying.
-- =============================================================