-- =============================================================
-- Rahisisha — RLS Preview (Day 2, Week 27)
-- Proves that Row-Level Security works on a real Postgres table.
-- Run this in order from top to bottom.
-- =============================================================


-- -------------------------------------------------------------
-- STEP 1: Create a minimal tenants table
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL
);


-- -------------------------------------------------------------
-- STEP 2: Create a products table with tenant_id
-- Every tenant-owned table in Rahisisha follows this pattern.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  name        TEXT NOT NULL,
  price_cents INTEGER NOT NULL
);


-- -------------------------------------------------------------
-- STEP 3: Seed two demo tenants and their products
-- -------------------------------------------------------------
INSERT INTO tenants (id, name) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Amina Boutique'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Brian Photography');

INSERT INTO products (tenant_id, name, price_cents) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Blue Dress Size M',  350000),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Red Dress Size L',   280000),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Wedding Shoot Package', 1500000),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Portrait Session',    450000);


-- -------------------------------------------------------------
-- STEP 4: BEFORE enabling RLS — no filter returns ALL rows
-- Run this and you will see all 4 products from both tenants.
-- This is the unsafe state — what happens without any protection.
-- -------------------------------------------------------------
-- SELECT * FROM products;
-- Expected: 4 rows (2 from Amina, 2 from Brian)


-- -------------------------------------------------------------
-- STEP 5: Enable RLS on the products table
-- Once enabled, ALL queries return zero rows by default
-- until a policy is added.
-- -------------------------------------------------------------
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;


-- -------------------------------------------------------------
-- STEP 6: Create the isolation policy
-- This policy says: only return rows where tenant_id matches
-- the current_tenant value set on the session.
-- The app sets this at the start of every request via:
--   SET LOCAL app.current_tenant = '<tenantId>';
-- -------------------------------------------------------------
CREATE POLICY tenant_isolation ON products
  USING (
    tenant_id = current_setting('app.current_tenant', TRUE)::UUID
  );


-- -------------------------------------------------------------
-- STEP 7: PROOF — query WITHOUT setting the tenant context
-- Run this and you will see ZERO rows returned.
-- RLS blocks everything when no tenant is set.
-- This is what protects against bugs where code forgets to filter.
-- -------------------------------------------------------------
SELECT * FROM products;
-- Expected: 0 rows


-- -------------------------------------------------------------
-- STEP 8: PROOF — query AS Amina (correct tenant set)
-- Now set the tenant context to Amina's ID and query again.
-- You will see ONLY Amina's 2 products — not Brian's.
-- -------------------------------------------------------------
SET LOCAL app.current_tenant = 'aaaaaaaa-0000-0000-0000-000000000001';
SELECT * FROM products;
-- Expected: 2 rows (Blue Dress, Red Dress) — Brian's are invisible


-- -------------------------------------------------------------
-- STEP 9: PROOF — query AS Brian (different tenant set)
-- Now set the tenant context to Brian's ID.
-- You will see ONLY Brian's 2 products — not Amina's.
-- -------------------------------------------------------------
SET LOCAL app.current_tenant = 'bbbbbbbb-0000-0000-0000-000000000002';
SELECT * FROM products;
-- Expected: 2 rows (Wedding Shoot, Portrait Session) — Amina's are invisible


-- -------------------------------------------------------------
-- STEP 10: PROOF — try to fetch Amina's product AS Brian
-- Even if Brian somehow knew Amina's product UUID,
-- he gets zero rows — not a 403, not an error, just nothing.
-- This is the behavior we enforce in the API: 404, not 403.
-- -------------------------------------------------------------
SET LOCAL app.current_tenant = 'bbbbbbbb-0000-0000-0000-000000000002';
SELECT * FROM products
WHERE id = (
  SELECT id FROM products
  WHERE name = 'Blue Dress Size M'
  LIMIT 1
);
-- Expected: 0 rows — RLS hides Amina's product from Brian completely


-- -------------------------------------------------------------
-- CLEANUP (run after testing, not in production)
-- -------------------------------------------------------------
-- DROP TABLE products;
-- DROP TABLE tenants;


-- =============================================================
-- WHAT THIS PROVES
-- =============================================================
-- 1. Without RLS: a missing WHERE clause exposes all tenants' data
-- 2. With RLS enabled but no context set: zero rows returned
-- 3. With correct tenant set: only that tenant's rows returned
-- 4. With wrong tenant set: the other tenant's rows are invisible
--
-- This is the "second lock" in Rahisisha's two-layer isolation:
--   Layer 1: withTenant() in application code (required argument)
--   Layer 2: RLS in Postgres (enforced even if Layer 1 has a bug)
-- =============================================================