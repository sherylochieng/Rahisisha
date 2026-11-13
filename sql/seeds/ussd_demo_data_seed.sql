-- =============================================================================
-- FILE: sql/seeds/ussd_demo_data_seed.sql
-- =============================================================================
--
-- WHY THIS FILE EXISTS
--   USSD menu options 1 (products) and 2 (balance) need real rows to show.
--   This file gives the two USSD demo shops their own products and wallet.
--
-- WHY IMPORTANT
--   The two shops get DIFFERENT data on purpose. If Amina's phone ever shows
--   a hammer, or Brio's shows a dress, we know isolation is broken.
--
-- DANGER
--   - products and wallet_entries have RLS (FORCE). An INSERT without
--     set_config('app.current_tenant', ...) is rejected.
--   - Demo data only. Never run against production customers' shops.
--
-- WHAT IT SOLVES
--   Lets us test the menu and the cross-tenant test with known numbers.
--
-- SYSTEM DESIGN PRINCIPLE
--   Idempotent seeds: safe to run many times. Each row is inserted only
--   if it does not already exist (WHERE NOT EXISTS).
--
-- RULES
--   1. Set the tenant lock before touching an RLS table.
--   2. Money is stored in cents (KSh 2,500 = 250000).
--   3. Re-running must not create duplicates.
--
-- PRACTICAL EXAMPLE
--   Amina's Boutique: Maxi Dress KSh 2,500; Kitenge Top KSh 1,200;
--   wallet = KSh 12,500.
--   Brio Hardware: Cement 50kg KSh 750; Hammer KSh 450; wallet = KSh 8,300.
--
-- DECISIONS
--   - DO blocks with set_config(..., true): the lock lasts only for this
--     statement's transaction, so nothing leaks to the next command.
--   - A SKU is used as the "already exists?" key. Products allow a unique
--     (tenant_id, sku) pair.
--   - Wallet rows use `reference` as the "already exists?" key.
--
-- WHERE USED / FUTURE USES
--   Run once locally after ussd_configs_seed.sql. Reused by the USSD
--   cross-tenant test (it looks up these known shops).
--
-- TRADEOFFS
--   Hard-coded slugs (aminas-boutique, brio-hardware): fine for demo seeds,
--   but they must exist in tenants first.
--
-- HOW TO USE (inside psql, as rahisisha_user):
--   \i sql/seeds/ussd_demo_data_seed.sql
-- =============================================================================

-- ---------- Amina's Boutique ----------
DO $$
DECLARE
  tid UUID;
BEGIN
  SELECT id INTO tid FROM tenants WHERE slug = 'aminas-boutique';
  IF tid IS NULL THEN
    RAISE NOTICE 'aminas-boutique not found, skipping';
    RETURN;
  END IF;

  PERFORM set_config('app.current_tenant', tid::text, true);

  INSERT INTO products (tenant_id, sku, name, price_cents, status)
  SELECT tid, 'USSD-AMN-001', 'Maxi Dress', 250000, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE tenant_id = tid AND sku = 'USSD-AMN-001');

  INSERT INTO products (tenant_id, sku, name, price_cents, status)
  SELECT tid, 'USSD-AMN-002', 'Kitenge Top', 120000, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE tenant_id = tid AND sku = 'USSD-AMN-002');

  INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference)
  SELECT tid, 1250000, 'sale', 'USSD-DEMO-AMN-1'
  WHERE NOT EXISTS (SELECT 1 FROM wallet_entries WHERE tenant_id = tid AND reference = 'USSD-DEMO-AMN-1');
END $$;

-- ---------- Brio Hardware ----------
DO $$
DECLARE
  tid UUID;
BEGIN
  SELECT id INTO tid FROM tenants WHERE slug = 'brio-hardware';
  IF tid IS NULL THEN
    RAISE NOTICE 'brio-hardware not found, skipping';
    RETURN;
  END IF;

  PERFORM set_config('app.current_tenant', tid::text, true);

  INSERT INTO products (tenant_id, sku, name, price_cents, status)
  SELECT tid, 'USSD-BRO-001', 'Cement 50kg', 75000, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE tenant_id = tid AND sku = 'USSD-BRO-001');

  INSERT INTO products (tenant_id, sku, name, price_cents, status)
  SELECT tid, 'USSD-BRO-002', 'Hammer', 45000, 'active'
  WHERE NOT EXISTS (SELECT 1 FROM products WHERE tenant_id = tid AND sku = 'USSD-BRO-002');

  INSERT INTO wallet_entries (tenant_id, amount_cents, reason, reference)
  SELECT tid, 830000, 'sale', 'USSD-DEMO-BRO-1'
  WHERE NOT EXISTS (SELECT 1 FROM wallet_entries WHERE tenant_id = tid AND reference = 'USSD-DEMO-BRO-1');
END $$;