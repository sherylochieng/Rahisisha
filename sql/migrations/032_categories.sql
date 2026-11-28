-- =============================================================================
-- FILE: sql/migrations/032_categories.sql   (Week 30 Day 3, Batch 4a-1: categories, step 1)
-- =============================================================================
--
-- WHY THIS FILE EXISTS
--   A marketplace needs aisles. This file creates the list of categories (Women's
--   fashion, Shoes, Food and groceries...) and lets each product say which
--   category it belongs to. The list is controlled by head office. Shops can only
--   pick from it.
--
-- WHY IMPORTANT
--   Shoppers will browse by category, and the marketplace (Batch 6) will build its
--   category pages from this. A fixed list keeps the marketplace tidy: no
--   "Dress", "dresses" and "Ladies wear" as three different aisles.
--
-- DANGER
--   1. Additive only. A NEW table and ONE new, empty column on products. Every
--      existing product simply has no category yet. Safe to run twice.
--   2. categories has NO tenant_id: it is shared reference data, the same for every
--      shop. Anyone (even a visitor) may READ it. Only head office (the admin lock,
--      app.platform_admin = 'on') may write it. Shops cannot add or change categories.
--   3. The starter list is put in while the admin lock is on for this transaction,
--      so it works whichever database role runs the file.
--   4. products.category_id is ON DELETE SET NULL: if a category is ever removed, its
--      products become uncategorised, never deleted.
--   5. Run as the owner of the tables (postgres locally, the owner role on Neon)
--      after a pg_dump backup.
--   6. The policy count goes from 25 to 27 (categories_read and admin_all).
--      scripts/reset-db.sh is updated to match.
--
-- WHAT IT SOLVES
--   "Which aisle is this product in?" and "what aisles exist?"
--
-- SYSTEM DESIGN PRINCIPLE
--   Reference data (a small shared list) kept apart from tenant data. A stable slug
--   (womens-fashion) for addresses and code, a friendly name for people, a
--   sort_order so head office decides the order.
--
-- RULES
--   1. slug: lowercase letters, numbers and single dashes, unique, at most 60 characters.
--   2. name: 1 to 60 characters.
--   3. active = false hides a category from shops and shoppers without deleting it.
--   4. One category per product (a single nullable column), by decision.
--
-- PRACTICAL EXAMPLE
--   Amina's Boutique sets her red dress to "Women's fashion". On the marketplace a
--   shopper opens /categories/womens-fashion and sees it, next to dresses from other
--   shops.
--
-- DECISIONS
--   - Ten starter categories, ending with "Other" so nothing is ever homeless.
--   - slug is the public handle. Renaming a category changes its name, never its slug.
--   - No tenant_id, so the isolation suite does not list this table. Its protection is
--     the two policies below.
--
-- WHERE USED
--   categories.service.js, products.controller.js, storefront.controller.js
--
-- TRADEOFFS
--   + Simple and fast. - One category per product; a product that fits two aisles must pick one.
--
-- HOW TO USE
--   Local (as postgres):  psql -d rahisisha -f sql/migrations/032_categories.sql
--   Neon: backup first, then the same file with the owner connection.
-- =============================================================================

BEGIN;

-- PIECE BY PIECE
--   1. The table.
--   2. The starter list (inserted with the admin lock on, before the lock is closed).
--   3. Row level security: everyone reads, only head office writes.
--   4. The new column on products and its index.

CREATE TABLE IF NOT EXISTS categories (
  -- id: a unique number for each category.
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- slug: the short address word, for example womens-fashion. Never changes.
  slug        TEXT NOT NULL UNIQUE
              CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 60),

  -- name: what people read, for example Women's fashion. May be reworded.
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),

  -- sort_order: smaller numbers come first. 'Other' is last.
  sort_order  INTEGER NOT NULL DEFAULT 100,

  -- active: false hides it everywhere without deleting anything.
  active      BOOLEAN NOT NULL DEFAULT TRUE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Turn the head-office switch on for THIS transaction only (true = until it ends),
-- so the starter list can be written whichever role runs this file.
SELECT set_config('app.platform_admin', 'on', true);

INSERT INTO categories (slug, name, sort_order) VALUES
  ('womens-fashion',   'Women''s fashion',       10),
  ('mens-fashion',     'Men''s fashion',         20),
  ('kids-baby',        'Kids and baby',          30),
  ('shoes',            'Shoes',                  40),
  ('bags-accessories', 'Bags and accessories',   50),
  ('beauty-hair',      'Beauty and hair',        60),
  ('food-groceries',   'Food and groceries',     70),
  ('electronics',      'Phones and electronics', 80),
  ('home-kitchen',     'Home and kitchen',       90),
  ('other',            'Other',                 999)
ON CONFLICT (slug) DO NOTHING;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE  ROW LEVEL SECURITY;

-- Everyone may READ the list.
DROP POLICY IF EXISTS categories_read ON categories;
CREATE POLICY categories_read ON categories
  FOR SELECT
  USING (true);

-- Only head office may add, change or remove categories.
DROP POLICY IF EXISTS admin_all ON categories;
CREATE POLICY admin_all ON categories
  USING      (current_setting('app.platform_admin', TRUE) = 'on')
  WITH CHECK (current_setting('app.platform_admin', TRUE) = 'on');

ALTER TABLE categories OWNER TO rahisisha_user;

-- Each product may say which category it is in. Empty for all existing products.
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES categories(id) ON DELETE SET NULL;

-- Category pages ask: "active, not deleted products in this category".
CREATE INDEX IF NOT EXISTS products_category_idx
  ON products (category_id)
  WHERE status = 'active' AND deleted_at IS NULL;

COMMIT;
