-- =============================================================
-- Migration 005 — Create product_variants table
-- Every variant of a product (size, colour) lives here.
-- THIS is where stock is tracked — not on the product itself.
-- ADR-006: stock tracked per variant, not per product.
-- "5 in stock" means nothing without knowing which size.
-- =============================================================

CREATE TABLE IF NOT EXISTS product_variants (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id)   ON DELETE CASCADE,
  product_id    UUID        NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  size          TEXT,                    -- S, M, L, XL, 36, 38... or NULL if no sizes
  colour        TEXT,                    -- Red, Blue... or NULL if no colours
  measurements  TEXT,                    -- "Bust 36, Waist 28" for dress shop use
  price_cents   INTEGER,                 -- override price for this variant
                                         -- NULL means use the product's base price
  stock         INTEGER     NOT NULL DEFAULT 0
                            CHECK (stock >= 0),
                                         -- can never go below zero
  sku           TEXT,                    -- variant-level SKU if needed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ             -- soft delete
);

-- A product cannot have two identical size+colour combos
-- Amina cannot have two "Blue / Size M" variants for the same dress
CREATE UNIQUE INDEX variants_product_size_colour_unique
  ON product_variants (product_id, size, colour)
  WHERE deleted_at IS NULL;

-- Fast lookup: "show me all variants for this product"
CREATE INDEX variants_product_idx
  ON product_variants (product_id)
  WHERE deleted_at IS NULL;

-- Fast lookup: all variants for this tenant
-- Used by the inventory dashboard and reservation system
CREATE INDEX variants_tenant_idx
  ON product_variants (tenant_id)
  WHERE deleted_at IS NULL;

-- Low stock alert index
-- "show me all variants for this tenant with stock < 3"
CREATE INDEX variants_tenant_stock_idx
  ON product_variants (tenant_id, stock)
  WHERE deleted_at IS NULL;

-- -------------------------------------------------------------
-- Enable RLS — variants are tenant-scoped
-- Brian cannot see or reserve Amina's dress sizes
-- -------------------------------------------------------------
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON product_variants
  USING (
    tenant_id = current_setting('app.current_tenant', TRUE)::UUID
  );

-- =============================================================
-- Stock rule: stock >= 0 is enforced at the database level.
-- The reservation system (Week 29) will lock this row before
-- decrementing to prevent two buyers claiming the last item.
-- Stock never drops on reservation — only on confirmed payment.
-- =============================================================